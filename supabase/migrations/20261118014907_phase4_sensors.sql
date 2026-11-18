-- =====================================================================
-- Phase 4: cold-chain monitoring. Part 1: enums, settings, sensors, device keys, calibration, readings (partitioned), ingest.
-- Error codes: WMS40 bad device key, WMS41 bad batch, WMS42 not allowed here, WMS43 invalid reading.
-- Sensors never touch the database directly: the ingest-reading Edge Function calls ingest_readings() with the SHA-256 of the device key.
-- =====================================================================
create type public.sensor_type    as enum ('TEMPERATURE', 'HUMIDITY', 'DOOR', 'POWER', 'COMPRESSOR');
create type public.sensor_status  as enum ('ACTIVE', 'OFFLINE', 'FAULTY', 'RETIRED');
create type public.reading_source as enum ('SENSOR', 'MANUAL');
create type public.alert_kind     as enum ('TEMP_HIGH', 'TEMP_LOW', 'OFFLINE', 'DOOR_OPEN', 'POWER_FAILURE', 'COMPRESSOR_FAULT', 'HUMIDITY', 'CALIBRATION_DUE', 'BATTERY_LOW');
create type public.alert_severity as enum ('WARNING', 'CRITICAL');
create type public.alert_status   as enum ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
create type public.equipment_type as enum ('CHILLER', 'COMPRESSOR', 'GENERATOR', 'FORKLIFT', 'RACK', 'OTHER');
create type public.task_status    as enum ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- ---------- settings: every threshold, tolerance, delay and retention lives here (or in alert_rules per zone) ----------
insert into public.app_settings (key, value, description) values
 ('coldchain', $j${
   "raw_retention_days": 30, "hourly_retention_days": 730, "future_minutes": 10, "late_days": 7, "batch_max": 100,
   "temp_floor": -60, "temp_ceiling": 80, "evidence_before_min": 30, "gap_cap_min": 15, "calibration_interval_days": 365,
   "maintenance_reminder_days": [7, 1],
   "defaults": {"tolerance_deg": 2, "delay_min": 10, "critical_deviation_deg": 5, "critical_after_min": 30, "recovery_min": 5,
                "offline_after_min": 15, "door_open_after_min": 5, "humidity_delay_min": 10, "battery_low_pct": 20,
                "calibration_warn_days": 7, "critical_ack_min": 15}
 }$j$::jsonb, 'Cold-chain thresholds, retention and defaults for zone alert rules'),
 ('notifications', $j${
   "email": true, "whatsapp": false, "sms": false,
   "client_notice_subject": "Temperature event at {warehouse}",
   "client_notice_body": "Dear {client}, a temperature event was recorded in zone {zone} at {warehouse} starting {start}. We are checking the effect on your stock and will keep you informed."
 }$j$::jsonb, 'Which channels are on, and the default wording of client notices (a manager approves before anything is sent)')
on conflict (key) do nothing;

create table public.internal_secrets (key text primary key, value text not null);   -- RLS on, no policies: only definer functions read it
create or replace function public.set_internal_secret(p_key text, p_value text) returns void language sql security definer set search_path = ''
as $$ insert into public.internal_secrets (key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value $$;

create or replace function public.cc(p_key text, p_default numeric) returns numeric language sql stable security definer set search_path = ''
as $$ select coalesce((select (value ->> p_key)::numeric from public.app_settings where key = 'coldchain'), p_default) $$;
create or replace function public.is_client() returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_app_role() = 'CLIENT', false) $$;

-- ---------- sensors ----------
create table public.sensors (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  zone_id uuid not null references public.zones(id),
  name text not null check (length(trim(name)) > 0),
  type public.sensor_type not null default 'TEMPERATURE',
  unit text not null default 'C',
  serial_no text not null unique check (length(trim(serial_no)) > 0),
  installed_on date, last_calibrated_at date, calibration_due_at date,
  status public.sensor_status not null default 'ACTIVE',
  is_manual boolean not null default false,              -- the per-zone virtual sensor that holds manual readings
  calibration_offset numeric(6,2) not null default 0,
  last_seen_at timestamptz, last_value numeric(6,2), last_raw_value numeric(6,2), battery_pct integer check (battery_pct between 0 and 100),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index sensors_zone_idx on public.sensors (zone_id);
create index sensors_warehouse_idx on public.sensors (warehouse_id);
create or replace function public.sensors_sync() returns trigger language plpgsql set search_path = '' as $$
begin
  select z.warehouse_id into new.warehouse_id from public.zones z where z.id = new.zone_id;
  if new.warehouse_id is null then raise exception 'Zone not found' using errcode = 'P0002'; end if;
  return new;
end $$;
create trigger sensors_sync before insert or update of zone_id on public.sensors for each row execute function public.sensors_sync();
create trigger set_updated_at before update on public.sensors for each row execute function public.set_updated_at();

-- ---------- device keys: shown once, only the hash is stored ----------
create table public.device_keys (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  sensor_id uuid references public.sensors(id),          -- null = a gateway key valid for every sensor of the warehouse
  label text not null,
  key_prefix text not null, key_hash text not null unique,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  revoked_at timestamptz, last_used_at timestamptz
);
create index device_keys_sensor_idx on public.device_keys (sensor_id);

create or replace function public.create_device_key(p_warehouse_id uuid, p_sensor_id uuid, p_label text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_key text; v_wh uuid := p_warehouse_id;
begin
  if not public.is_admin() then raise exception 'Only an administrator can create device keys' using errcode = '42501'; end if;
  if p_sensor_id is not null then
    select warehouse_id into v_wh from public.sensors where id = p_sensor_id and deleted_at is null;
    if v_wh is null then raise exception 'Sensor not found' using errcode = 'P0002'; end if;
  end if;
  if v_wh is null or not exists (select 1 from public.warehouses where id = v_wh) then raise exception 'Warehouse not found' using errcode = 'P0002'; end if;
  v_key := 'wms_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.device_keys (warehouse_id, sensor_id, label, key_prefix, key_hash)
  values (v_wh, p_sensor_id, coalesce(nullif(trim(p_label), ''), 'Device key'), left(v_key, 8), encode(extensions.digest(v_key, 'sha256'), 'hex'));
  return v_key;                                           -- the only time the plain key exists
end $$;

create or replace function public.rotate_device_key(p_key_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare k public.device_keys;
begin
  if not public.is_admin() then raise exception 'Only an administrator can rotate device keys' using errcode = '42501'; end if;
  select * into k from public.device_keys where id = p_key_id and revoked_at is null for update;
  if not found then raise exception 'Key not found or already revoked' using errcode = 'P0002'; end if;
  update public.device_keys set revoked_at = now() where id = k.id;
  return public.create_device_key(k.warehouse_id, k.sensor_id, k.label);
end $$;

create or replace function public.revoke_device_key(p_key_id uuid) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can revoke device keys' using errcode = '42501'; end if;
  update public.device_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key_id;
end $$;

-- ---------- calibration ----------
create table public.calibration_log (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references public.sensors(id),
  warehouse_id uuid not null references public.warehouses(id),
  calibrated_on date not null,
  reference_value numeric(6,2) not null, sensor_value numeric(6,2) not null, offset_applied numeric(6,2) not null,
  certificate_path text, notes text,
  done_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create index calibration_log_sensor_idx on public.calibration_log (sensor_id, calibrated_on desc);

create or replace function public.record_calibration(p_sensor_id uuid, p_date date, p_reference numeric, p_sensor_value numeric,
                                                      p_certificate_path text default null, p_notes text default null, p_next_due date default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare s public.sensors; v_id uuid; v_off numeric := round(p_reference - p_sensor_value, 2);
begin
  select * into s from public.sensors where id = p_sensor_id and deleted_at is null for update;
  if not found then raise exception 'Sensor not found' using errcode = 'P0002'; end if;
  if not public.can_write_warehouse(s.warehouse_id) then raise exception 'Only an administrator or the warehouse manager can calibrate sensors' using errcode = '42501'; end if;
  insert into public.calibration_log (sensor_id, warehouse_id, calibrated_on, reference_value, sensor_value, offset_applied, certificate_path, notes)
  values (s.id, s.warehouse_id, p_date, p_reference, p_sensor_value, v_off, p_certificate_path, p_notes) returning id into v_id;
  update public.sensors set calibration_offset = v_off, last_calibrated_at = p_date,
         calibration_due_at = coalesce(p_next_due, p_date + public.cc('calibration_interval_days', 365)::integer) where id = s.id;
  return v_id;
end $$;

-- ---------- readings: partitioned by month, lean rows; hourly roll-up after 30 days ----------
create table public.readings (
  sensor_id uuid not null references public.sensors(id),
  recorded_at timestamptz not null,
  value numeric(6,2) not null,            -- calibrated value shown everywhere
  raw_value numeric(6,2) not null,        -- exactly what the device sent
  source public.reading_source not null default 'SENSOR',
  recorded_by uuid, photo_path text, note text,
  primary key (sensor_id, recorded_at)
) partition by range (recorded_at);

create table public.readings_hourly (
  sensor_id uuid not null references public.sensors(id),
  hour timestamptz not null,
  min_value numeric(6,2) not null, max_value numeric(6,2) not null, avg_value numeric(6,2) not null, n integer not null,
  primary key (sensor_id, hour)
);

create or replace function public.ensure_reading_partitions(p_back integer default 2, p_ahead integer default 3)
returns integer language plpgsql security definer set search_path = ''
as $$
declare m integer; d0 timestamptz; d1 timestamptz; v_name text; v_n integer := 0;
begin
  for m in -p_back..p_ahead loop
    d0 := date_trunc('month', (now() at time zone 'UTC') + make_interval(months => m)) at time zone 'UTC';
    d1 := d0 + interval '1 month';
    v_name := format('readings_y%sm%s', to_char(d0 at time zone 'UTC', 'YYYY'), to_char(d0 at time zone 'UTC', 'MM'));
    if to_regclass('public.' || v_name) is null then
      execute format('create table public.%I partition of public.readings for values from (%L) to (%L)', v_name, d0, d1);
      execute format('alter table public.%I enable row level security', v_name);       -- partitions are reachable by name: no policies = no access
      execute format('revoke all on public.%I from anon, authenticated', v_name);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
select public.ensure_reading_partitions(2, 3);

-- ---------- ingest: called only by the Edge Function (service role) ----------
create or replace function public.ingest_readings(p_key_hash text, p_readings jsonb, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare k public.device_keys; s public.sensors; e jsonb; i integer := 0; ts timestamptz; v numeric; v_raw numeric; v_ok integer := 0; v_dup integer := 0;
  v_rej jsonb := '[]'::jsonb; v_why text; v_rows integer; v_last record;
  v_future interval := make_interval(mins => public.cc('future_minutes', 10)::integer);
  v_late interval := make_interval(days => public.cc('late_days', 7)::integer);
  v_floor numeric := public.cc('temp_floor', -60); v_ceil numeric := public.cc('temp_ceiling', 80);
begin
  select * into k from public.device_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then raise exception 'Invalid device key' using errcode = 'WMS40'; end if;
  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) = 0 or jsonb_array_length(p_readings) > public.cc('batch_max', 100) then
    raise exception 'Send between 1 and % readings', public.cc('batch_max', 100)::integer using errcode = 'WMS41';
  end if;
  update public.device_keys set last_used_at = p_now where id = k.id;

  for e in select x from jsonb_array_elements(p_readings) x loop
    i := i + 1; v_why := null; s := null;
    begin
      select * into s from public.sensors where serial_no = (e ->> 'sensor') and deleted_at is null;
      if not found then v_why := 'unknown_sensor';
      elsif s.warehouse_id <> k.warehouse_id or (k.sensor_id is not null and k.sensor_id <> s.id) then v_why := 'sensor_not_allowed';
      elsif s.status = 'RETIRED' then v_why := 'sensor_retired';
      elsif s.is_manual then v_why := 'sensor_not_allowed';
      elsif jsonb_typeof(e -> 'value') is distinct from 'number' then v_why := 'bad_value';
      elsif e ->> 'unit' is not null and upper(e ->> 'unit') <> upper(s.unit) then v_why := 'unit_mismatch';
      end if;
      if v_why is null then
        v_raw := (e ->> 'value')::numeric;
        ts := coalesce((e ->> 'timestamp')::timestamptz, p_now);
        if ts > p_now + v_future then v_why := 'future_timestamp';
        elsif ts < p_now - v_late then v_why := 'too_old';
        elsif s.type = 'TEMPERATURE' and (v_raw < v_floor or v_raw > v_ceil) then v_why := 'value_out_of_range';
        elsif s.type = 'HUMIDITY' and (v_raw < 0 or v_raw > 100) then v_why := 'value_out_of_range';
        elsif s.type in ('DOOR', 'POWER', 'COMPRESSOR') and v_raw not in (0, 1) then v_why := 'value_out_of_range';
        end if;
      end if;
      if v_why is null then
        v := case when s.type = 'TEMPERATURE' then round(v_raw + s.calibration_offset, 2) else v_raw end;
        insert into public.readings (sensor_id, recorded_at, value, raw_value, source) values (s.id, ts, v, v_raw, 'SENSOR') on conflict do nothing;
        get diagnostics v_rows = row_count;
        if v_rows = 0 then v_dup := v_dup + 1;
        else
          v_ok := v_ok + 1;
          update public.sensors set
            last_seen_at = greatest(coalesce(last_seen_at, ts), ts),
            last_value = case when last_seen_at is null or ts >= last_seen_at then v else last_value end,
            last_raw_value = case when last_seen_at is null or ts >= last_seen_at then v_raw else last_raw_value end,
            battery_pct = case when (e ->> 'battery') ~ '^[0-9]{1,3}$' and (e ->> 'battery')::integer <= 100 and (last_seen_at is null or ts >= last_seen_at)
                               then (e ->> 'battery')::integer else battery_pct end
          where id = s.id;
        end if;
      end if;
    exception when others then v_why := coalesce(v_why, case when sqlstate in ('22007', '22008', '22P02') then 'bad_timestamp' else 'storage_error' end);
    end;
    if v_why is not null then v_rej := v_rej || jsonb_build_object('index', i - 1, 'sensor', e ->> 'sensor', 'reason', v_why); end if;
  end loop;
  return jsonb_build_object('accepted', v_ok, 'duplicates', v_dup, 'rejected', v_rej);
end $$;

-- ---------- manual readings (staff fallback): feed alerts and reports like any sensor ----------
create or replace function public.manual_sensor_for_zone(p_zone_id uuid) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; z public.zones;
begin
  select * into z from public.zones where id = p_zone_id and deleted_at is null;
  if not found then raise exception 'Zone not found' using errcode = 'P0002'; end if;
  select id into v_id from public.sensors where zone_id = p_zone_id and is_manual and deleted_at is null;
  if v_id is null then
    insert into public.sensors (zone_id, warehouse_id, name, type, unit, serial_no, is_manual, installed_on)
    values (z.id, z.warehouse_id, 'Manual readings ' || z.code, 'TEMPERATURE', 'C', 'MANUAL-' || z.id::text, true, public.today_ist()) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.add_manual_reading(p_zone_id uuid, p_value numeric, p_photo_path text default null, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare z public.zones; v_s uuid; v_at timestamptz := clock_timestamp();
begin
  select * into z from public.zones where id = p_zone_id and deleted_at is null;
  if not found then raise exception 'Zone not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(z.warehouse_id) then raise exception 'Not allowed in this warehouse' using errcode = '42501'; end if;
  if p_value is null or p_value < public.cc('temp_floor', -60) or p_value > public.cc('temp_ceiling', 80) then
    raise exception 'The temperature is outside the possible range' using errcode = 'WMS43';
  end if;
  v_s := public.manual_sensor_for_zone(p_zone_id);
  insert into public.readings (sensor_id, recorded_at, value, raw_value, source, recorded_by, photo_path, note)
  values (v_s, v_at, round(p_value, 2), round(p_value, 2), 'MANUAL', auth.uid(), nullif(p_photo_path, ''), nullif(p_note, ''));
  update public.sensors set last_seen_at = v_at, last_value = round(p_value, 2), last_raw_value = round(p_value, 2) where id = v_s;
  return v_at;
end $$;
