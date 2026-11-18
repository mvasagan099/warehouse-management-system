-- =====================================================================
-- Phase 4 part 2: equipment, alert rules, defrost windows, alerts, evidence, affected stock, notifications, client notices,
-- the alert engine (evaluate_alerts, run every minute by pg_cron) and the lifecycle functions.
-- =====================================================================
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  zone_id uuid references public.zones(id),
  type public.equipment_type not null default 'OTHER',
  name text not null check (length(trim(name)) > 0), code text,
  vendor text, vendor_phone text, warranty_end date,
  service_interval_days integer check (service_interval_days is null or service_interval_days > 0),
  last_service_on date, next_service_due date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'FAULTY', 'RETIRED')),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index equipment_warehouse_idx on public.equipment (warehouse_id);

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id),
  warehouse_id uuid not null references public.warehouses(id),
  title text not null default 'Service',
  due_date date not null,
  assigned_to uuid references public.profiles(id),
  status public.task_status not null default 'OPEN',
  notes text, photos text[] not null default '{}',
  completed_at timestamptz, completed_by uuid,
  alert_id uuid,
  reminded_7 boolean not null default false, reminded_1 boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index maintenance_tasks_equipment_idx on public.maintenance_tasks (equipment_id, due_date);
create or replace function public.equipment_children_sync() returns trigger language plpgsql set search_path = '' as $$
begin
  select e.warehouse_id into new.warehouse_id from public.equipment e where e.id = new.equipment_id;
  return new;
end $$;
create trigger maintenance_tasks_sync before insert or update of equipment_id on public.maintenance_tasks for each row execute function public.equipment_children_sync();
create trigger set_updated_at before update on public.equipment for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.maintenance_tasks for each row execute function public.set_updated_at();

-- ---------- zone alert rules (null column = default from settings; null limits = the zone's own temp_min / temp_max) ----------
create table public.alert_rules (
  zone_id uuid primary key references public.zones(id),
  warehouse_id uuid not null references public.warehouses(id),
  enabled boolean not null default true,
  min_temp numeric(5,2), max_temp numeric(5,2),
  tolerance_deg numeric(4,1) check (tolerance_deg is null or tolerance_deg >= 0),
  delay_min integer check (delay_min is null or delay_min >= 0),
  critical_deviation_deg numeric(4,1), critical_after_min integer,
  recovery_min integer, offline_after_min integer, door_open_after_min integer,
  humidity_min numeric(5,1), humidity_max numeric(5,1), humidity_delay_min integer,
  battery_low_pct integer, calibration_warn_days integer, critical_ack_min integer,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.defrost_windows (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id),
  warehouse_id uuid not null references public.warehouses(id),
  name text not null default 'Defrost',
  start_time time not null, end_time time not null,       -- India time; a window may cross midnight
  days integer[],                                          -- ISO weekdays 1-7, null = every day
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (start_time <> end_time)
);
create index defrost_windows_zone_idx on public.defrost_windows (zone_id);
create or replace function public.zone_children_sync() returns trigger language plpgsql set search_path = '' as $$
begin
  select z.warehouse_id into new.warehouse_id from public.zones z where z.id = new.zone_id;
  return new;
end $$;
create trigger alert_rules_sync before insert or update of zone_id on public.alert_rules for each row execute function public.zone_children_sync();
create trigger defrost_windows_sync before insert or update of zone_id on public.defrost_windows for each row execute function public.zone_children_sync();
create trigger set_updated_at before update on public.alert_rules for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.defrost_windows for each row execute function public.set_updated_at();

create type public.effective_rule as (enabled boolean, min_temp numeric, max_temp numeric, tolerance_deg numeric, delay_min integer,
  critical_deviation_deg numeric, critical_after_min integer, recovery_min integer, offline_after_min integer, door_open_after_min integer,
  humidity_min numeric, humidity_max numeric, humidity_delay_min integer, battery_low_pct integer, calibration_warn_days integer, critical_ack_min integer);

create or replace function public.effective_rule(p_zone_id uuid) returns public.effective_rule language plpgsql stable security definer set search_path = ''
as $$
declare r public.alert_rules; d jsonb := coalesce((select value -> 'defaults' from public.app_settings where key = 'coldchain'), '{}'::jsonb); o public.effective_rule;
begin
  select * into r from public.alert_rules where zone_id = p_zone_id;
  o.enabled := coalesce(r.enabled, true); o.min_temp := r.min_temp; o.max_temp := r.max_temp;
  o.tolerance_deg := coalesce(r.tolerance_deg, (d ->> 'tolerance_deg')::numeric, 2);
  o.delay_min := coalesce(r.delay_min, (d ->> 'delay_min')::integer, 10);
  o.critical_deviation_deg := coalesce(r.critical_deviation_deg, (d ->> 'critical_deviation_deg')::numeric, 5);
  o.critical_after_min := coalesce(r.critical_after_min, (d ->> 'critical_after_min')::integer, 30);
  o.recovery_min := coalesce(r.recovery_min, (d ->> 'recovery_min')::integer, 5);
  o.offline_after_min := coalesce(r.offline_after_min, (d ->> 'offline_after_min')::integer, 15);
  o.door_open_after_min := coalesce(r.door_open_after_min, (d ->> 'door_open_after_min')::integer, 5);
  o.humidity_min := r.humidity_min; o.humidity_max := r.humidity_max;
  o.humidity_delay_min := coalesce(r.humidity_delay_min, (d ->> 'humidity_delay_min')::integer, 10);
  o.battery_low_pct := coalesce(r.battery_low_pct, (d ->> 'battery_low_pct')::integer, 20);
  o.calibration_warn_days := coalesce(r.calibration_warn_days, (d ->> 'calibration_warn_days')::integer, 7);
  o.critical_ack_min := coalesce(r.critical_ack_min, (d ->> 'critical_ack_min')::integer, 15);
  return o;
end $$;

create or replace function public.in_defrost(p_zone_id uuid, p_ts timestamptz) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.defrost_windows w,
    lateral (select (p_ts at time zone 'Asia/Kolkata')::time t, extract(isodow from (p_ts at time zone 'Asia/Kolkata'))::integer dow) x
    where w.zone_id = p_zone_id and w.is_active and (w.days is null or x.dow = any (w.days))
      and ((w.start_time < w.end_time and x.t >= w.start_time and x.t < w.end_time)
        or (w.start_time > w.end_time and (x.t >= w.start_time or x.t < w.end_time))))
$$;

-- degrees beyond the limit when a reading breaches (limit +/- tolerance), else null. High readings inside a defrost window are ignored.
create or replace function public.temp_dev(p_value numeric, p_lo numeric, p_hi numeric, p_tol numeric, p_zone uuid, p_ts timestamptz)
returns numeric language sql stable security definer set search_path = ''
as $$
  select case
    when p_hi is not null and p_value > p_hi + p_tol then case when public.in_defrost(p_zone, p_ts) then null else p_value - p_hi end
    when p_lo is not null and p_value < p_lo - p_tol then p_lo - p_value
  end
$$;

-- ---------- alerts ----------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind public.alert_kind not null, severity public.alert_severity not null, status public.alert_status not null default 'OPEN',
  warehouse_id uuid not null references public.warehouses(id), zone_id uuid not null references public.zones(id),
  sensor_id uuid references public.sensors(id), equipment_id uuid references public.equipment(id), maintenance_task_id uuid references public.maintenance_tasks(id),
  opened_at timestamptz not null, event_start timestamptz not null, recovered_at timestamptz,
  limit_value numeric(6,2), peak_value numeric(6,2), peak_deviation numeric(6,2) not null default 0, duration_min integer not null default 0,
  acknowledged_by uuid, acknowledged_at timestamptz,
  resolved_by uuid, resolved_at timestamptz, cause text, action_taken text,
  escalation_level integer not null default 0, escalated_at timestamptz,
  details jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint alerts_resolution check (status <> 'RESOLVED' or (coalesce(trim(cause), '') <> '' and coalesce(trim(action_taken), '') <> ''))
);
-- one live alert per sensor and kind: the same breach can never open twice
create unique index alerts_one_live on public.alerts (sensor_id, kind) where recovered_at is null;
create index alerts_wh_idx on public.alerts (warehouse_id, opened_at desc);
create index alerts_zone_idx on public.alerts (zone_id, opened_at desc);
alter table public.maintenance_tasks add constraint maintenance_tasks_alert_fk foreign key (alert_id) references public.alerts(id);
create trigger set_updated_at before update on public.alerts for each row execute function public.set_updated_at();

create table public.alert_evidence (
  alert_id uuid not null references public.alerts(id), sensor_id uuid not null references public.sensors(id), recorded_at timestamptz not null,
  value numeric(6,2) not null, raw_value numeric(6,2) not null, source public.reading_source not null,
  primary key (alert_id, sensor_id, recorded_at)
);
create table public.alert_stock (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id), client_id uuid not null references public.clients(id), client_name text not null,
  zone_id uuid not null references public.zones(id), slot_id uuid, slot_code text,
  stock_item_id uuid, item_name text, batch_no text, expiry_date date, quantity numeric(14,3), unit text
);
create index alert_stock_alert_idx on public.alert_stock (alert_id);
create index alert_stock_client_idx on public.alert_stock (client_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  kind text not null, title text not null, body text, alert_id uuid references public.alerts(id), task_id uuid references public.maintenance_tasks(id),
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(), channel text not null check (channel in ('EMAIL', 'WHATSAPP', 'SMS')),
  to_address text not null, subject text, body text not null,
  alert_id uuid references public.alerts(id), task_id uuid references public.maintenance_tasks(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  error text, attempts integer not null default 0, created_at timestamptz not null default now(), sent_at timestamptz
);
create index outbox_pending_idx on public.notification_outbox (created_at) where status = 'PENDING';

create table public.client_notices (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id), client_id uuid not null references public.clients(id), warehouse_id uuid not null references public.warehouses(id),
  subject text not null, body text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'REJECTED')),
  approved_by uuid, approved_at timestamptz, created_at timestamptz not null default now(),
  unique (alert_id, client_id)
);

-- ---------- evidence, affected stock ----------
create or replace function public.copy_alert_evidence(p_alert_id uuid, p_now timestamptz default now()) returns integer language plpgsql security definer set search_path = ''
as $$
declare a public.alerts; v_n integer;
begin
  select * into a from public.alerts where id = p_alert_id;
  if not found or a.sensor_id is null then return 0; end if;
  insert into public.alert_evidence (alert_id, sensor_id, recorded_at, value, raw_value, source)
  select a.id, r.sensor_id, r.recorded_at, r.value, r.raw_value, r.source from public.readings r
  where r.sensor_id = a.sensor_id and r.recorded_at >= a.event_start - make_interval(mins => public.cc('evidence_before_min', 30)::integer)
    and r.recorded_at <= coalesce(a.recovered_at, p_now)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- clients, batches and Brigades in a zone during [p_from, p_to] (allocation dates are India calendar days; stock must have arrived by the end and not left before the start)
create or replace function public.affected_stock(p_zone_id uuid, p_from timestamptz, p_to timestamptz)
returns table (client_id uuid, client_name text, slot_id uuid, slot_code text, stock_item_id uuid, item_name text, batch_no text, expiry_date date, quantity numeric, unit text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.company_name, s.id, s.code, si.id, si.item_name, si.batch_no, si.expiry_date, si.quantity, si.unit
  from public.slot_allocations a
  join public.clients c on c.id = a.client_id
  join public.brigade_slots s on s.id = a.slot_id
  left join public.stock_items si on si.slot_id = a.slot_id and si.client_id = a.client_id and si.deleted_at is null and si.received_at <= p_to
       and (si.quantity > 0 or exists (select 1 from public.stock_movements m where m.stock_item_id = si.id and m.movement_type = 'OUT' and m.created_at >= p_from))
  where a.zone_id = p_zone_id and not a.cancelled
    and a.start_date <= (p_to at time zone 'Asia/Kolkata')::date
    and (a.end_date is null or a.end_date >= (p_from at time zone 'Asia/Kolkata')::date)
  order by c.company_name, s.code, si.batch_no
$$;

create or replace function public.snapshot_alert_stock(p_alert_id uuid, p_now timestamptz default now()) returns integer language plpgsql security definer set search_path = ''
as $$
declare a public.alerts; v_n integer; n jsonb := coalesce((select value from public.app_settings where key = 'notifications'), '{}'::jsonb);
  w public.warehouses; z public.zones; r record; v_title text;
begin
  select * into a from public.alerts where id = p_alert_id;
  if not found or a.status = 'RESOLVED' or a.kind in ('OFFLINE', 'CALIBRATION_DUE', 'BATTERY_LOW') then return 0; end if;
  delete from public.alert_stock where alert_id = a.id;
  insert into public.alert_stock (alert_id, client_id, client_name, zone_id, slot_id, slot_code, stock_item_id, item_name, batch_no, expiry_date, quantity, unit)
  select a.id, x.client_id, x.client_name, a.zone_id, x.slot_id, x.slot_code, x.stock_item_id, x.item_name, x.batch_no, x.expiry_date, x.quantity, x.unit
  from public.affected_stock(a.zone_id, a.event_start, coalesce(a.recovered_at, p_now)) x;
  get diagnostics v_n = row_count;
  select * into w from public.warehouses where id = a.warehouse_id; select * into z from public.zones where id = a.zone_id;
  -- one draft notice per affected client: nothing is sent until a manager approves the wording
  for r in select distinct s.client_id, s.client_name from public.alert_stock s where s.alert_id = a.id loop
    insert into public.client_notices (alert_id, client_id, warehouse_id, subject, body)
    values (a.id, r.client_id, a.warehouse_id,
      replace(replace(coalesce(n ->> 'client_notice_subject', 'Temperature event at {warehouse}'), '{warehouse}', w.name), '{zone}', z.code),
      replace(replace(replace(replace(replace(coalesce(n ->> 'client_notice_body', 'A temperature event was recorded in zone {zone}.'), '{client}', r.client_name),
        '{zone}', z.code || ' ' || z.name), '{warehouse}', w.name), '{start}', to_char(a.event_start at time zone 'Asia/Kolkata', 'DD Mon YYYY HH12:MI AM')), '{peak}', coalesce(a.peak_value::text, '')))
    on conflict (alert_id, client_id) do nothing;
    if found then
      insert into public.notifications (user_id, kind, title, body, alert_id)
      select p.id, 'NOTICE_PENDING', format('Client notice to approve: %s', r.client_name), format('Zone %s alert affects %s.', z.code, r.client_name), a.id
      from public.profiles p where p.role = 'WAREHOUSE_MANAGER' and p.is_active and p.deleted_at is null
        and exists (select 1 from public.warehouse_managers m where m.user_id = p.id and m.warehouse_id = a.warehouse_id and m.deleted_at is null);
    end if;
  end loop;
  return v_n;
end $$;

-- ---------- notifications ----------
create or replace function public.alert_recipients(p_warehouse_id uuid, p_level integer)
returns table (user_id uuid, email text, phone text) language plpgsql stable security definer set search_path = ''
as $$
declare v_lvl integer := p_level;
begin
  loop
    return query
      select p.id, p.email, p.phone from public.profiles p where p.is_active and p.deleted_at is null and (
        (v_lvl = 0 and p.role = 'STAFF' and p.warehouse_id = p_warehouse_id)
        or (v_lvl = 1 and p.role = 'WAREHOUSE_MANAGER' and exists (select 1 from public.warehouse_managers m where m.user_id = p.id and m.warehouse_id = p_warehouse_id and m.deleted_at is null))
        or (v_lvl >= 2 and p.role = 'SUPER_ADMIN'));
    if found or v_lvl >= 2 then return; end if;
    v_lvl := v_lvl + 1;                                   -- nobody at this level: the next person up gets it
  end loop;
end $$;

create or replace function public.queue_message(p_user uuid, p_email text, p_phone text, p_kind text, p_title text, p_body text, p_alert uuid default null, p_task uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare n jsonb := coalesce((select value from public.app_settings where key = 'notifications'), '{}'::jsonb);
begin
  if p_user is not null then insert into public.notifications (user_id, kind, title, body, alert_id, task_id) values (p_user, p_kind, p_title, p_body, p_alert, p_task); end if;
  if coalesce((n ->> 'email')::boolean, true) and p_email is not null then
    insert into public.notification_outbox (channel, to_address, subject, body, alert_id, task_id) values ('EMAIL', p_email, p_title, p_body, p_alert, p_task); end if;
  if coalesce((n ->> 'whatsapp')::boolean, false) and p_phone is not null then
    insert into public.notification_outbox (channel, to_address, subject, body, alert_id, task_id) values ('WHATSAPP', p_phone, p_title, p_body, p_alert, p_task); end if;
  if coalesce((n ->> 'sms')::boolean, false) and p_phone is not null then
    insert into public.notification_outbox (channel, to_address, subject, body, alert_id, task_id) values ('SMS', p_phone, p_title, p_body, p_alert, p_task); end if;
end $$;

create or replace function public.notify_alert(p_alert_id uuid, p_level integer, p_headline text) returns integer language plpgsql security definer set search_path = ''
as $$
declare a public.alerts; z public.zones; w public.warehouses; r record; v_n integer := 0; v_title text; v_body text;
begin
  select * into a from public.alerts where id = p_alert_id; select * into z from public.zones where id = a.zone_id; select * into w from public.warehouses where id = a.warehouse_id;
  v_title := format('%s %s: %s - zone %s (%s)', a.severity, replace(lower(a.kind::text), '_', ' '), p_headline, z.code, w.code);
  v_body := format('%s alert in zone %s %s at %s since %s India time.%s', a.severity, z.code, z.name, w.name, to_char(a.event_start at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
                   case when a.peak_value is not null then format(' Peak %s C (%s C beyond the limit).', a.peak_value, a.peak_deviation) else '' end);
  for r in select * from public.alert_recipients(a.warehouse_id, p_level) loop
    perform public.queue_message(r.user_id, r.email, r.phone, 'ALERT', v_title, v_body, a.id); v_n := v_n + 1;
  end loop;
  update public.alerts set details = coalesce(details, '{}'::jsonb) || jsonb_build_object('last_notified_level', p_level, 'last_notified_at', now()) where id = a.id;
  return v_n;
end $$;

-- ---------- opening and closing ----------
create or replace function public.open_alert(p_kind public.alert_kind, p_sev public.alert_severity, p_sensor uuid, p_zone uuid, p_start timestamptz,
  p_limit numeric, p_peak numeric, p_dev numeric, p_now timestamptz, p_headline text) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_wh uuid;
begin
  select warehouse_id into v_wh from public.zones where id = p_zone;
  insert into public.alerts (kind, severity, warehouse_id, zone_id, sensor_id, opened_at, event_start, limit_value, peak_value, peak_deviation, duration_min, escalated_at)
  values (p_kind, p_sev, v_wh, p_zone, p_sensor, p_now, p_start, p_limit, p_peak, coalesce(p_dev, 0), greatest(floor(extract(epoch from p_now - p_start) / 60), 0)::integer, p_now)
  on conflict (sensor_id, kind) where recovered_at is null do nothing returning id into v_id;
  if v_id is null then return null; end if;
  perform public.copy_alert_evidence(v_id, p_now);
  perform public.snapshot_alert_stock(v_id, p_now);
  perform public.notify_alert(v_id, 0, p_headline);
  return v_id;
end $$;

create or replace function public.close_alert(p_alert_id uuid, p_recovered timestamptz, p_now timestamptz) returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.alerts set recovered_at = p_recovered, duration_min = greatest(floor(extract(epoch from p_recovered - event_start) / 60), 0)::integer where id = p_alert_id and recovered_at is null;
  perform public.copy_alert_evidence(p_alert_id, p_now);
  perform public.snapshot_alert_stock(p_alert_id, p_now);
end $$;

-- ---------- the engine ----------
create or replace function public.evaluate_alerts(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path = ''
as $$
declare s record; r public.effective_rule; a public.alerts; l record; zmin numeric; zmax numeric; lo numeric; hi numeric; dev numeric;
  last_ok timestamptz; v_start timestamptz; v_peak numeric; v_peak_val numeric; dur integer; delay integer; sev public.alert_severity; v_kind public.alert_kind;
  lb timestamptz; v_rec timestamptz; v_opened integer := 0; v_id uuid; v_bad numeric; v_win timestamptz := p_now - interval '24 hours'; lim numeric;
begin
  -- 1. temperature sensors (sensor and manual readings alike)
  for s in select * from public.sensors where type = 'TEMPERATURE' and status <> 'RETIRED' and deleted_at is null and last_seen_at is not null loop
    r := public.effective_rule(s.zone_id);
    continue when not r.enabled;
    select temp_min, temp_max into zmin, zmax from public.zones where id = s.zone_id;
    lo := coalesce(r.min_temp, zmin); hi := coalesce(r.max_temp, zmax);
    continue when lo is null and hi is null;
    select recorded_at, value into l from public.readings where sensor_id = s.id and recorded_at <= p_now order by recorded_at desc limit 1;
    continue when not found;
    continue when not s.is_manual and p_now - l.recorded_at > make_interval(mins => r.offline_after_min);   -- silent sensors raise OFFLINE instead
    dev := public.temp_dev(l.value, lo, hi, r.tolerance_deg, s.zone_id, l.recorded_at);
    if dev is not null then
      select max(recorded_at) into last_ok from public.readings where sensor_id = s.id and recorded_at > v_win and recorded_at <= p_now
         and public.temp_dev(value, lo, hi, r.tolerance_deg, s.zone_id, recorded_at) is null;
      select min(recorded_at), max(public.temp_dev(value, lo, hi, r.tolerance_deg, s.zone_id, recorded_at)) into v_start, v_peak from public.readings
       where sensor_id = s.id and recorded_at > coalesce(last_ok, v_win) and recorded_at <= p_now;
      select value into v_peak_val from public.readings where sensor_id = s.id and recorded_at > coalesce(last_ok, v_win) and recorded_at <= p_now
         and public.temp_dev(value, lo, hi, r.tolerance_deg, s.zone_id, recorded_at) = v_peak order by recorded_at limit 1;
      v_kind := case when l.value > coalesce(hi, 1e9) then 'TEMP_HIGH' else 'TEMP_LOW' end;
      lim := case when v_kind = 'TEMP_HIGH' then hi else lo end;
      dur := greatest(floor(extract(epoch from p_now - v_start) / 60), 0)::integer;
      delay := case when s.is_manual then 0 else r.delay_min end;
      sev := case when v_peak > r.critical_deviation_deg or dur >= r.critical_after_min then 'CRITICAL' else 'WARNING' end;
      select * into a from public.alerts where sensor_id = s.id and kind = v_kind and recovered_at is null;
      if found then
        update public.alerts set duration_min = dur, peak_deviation = greatest(peak_deviation, v_peak),
               peak_value = case when v_peak > peak_deviation then v_peak_val else peak_value end
         where id = a.id and (duration_min is distinct from dur or v_peak > peak_deviation);
        if a.severity = 'WARNING' and sev = 'CRITICAL' then
          update public.alerts set severity = 'CRITICAL', escalated_at = p_now where id = a.id;
          perform public.copy_alert_evidence(a.id, p_now);
          perform public.notify_alert(a.id, 0, 'now CRITICAL');
        end if;
      elsif dur >= delay then
        v_id := public.open_alert(v_kind, sev, s.id, s.zone_id, v_start, lim, v_peak_val, v_peak, p_now, 'temperature out of range');
        if v_id is not null then v_opened := v_opened + 1; end if;
      end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind in ('TEMP_HIGH', 'TEMP_LOW') and recovered_at is null loop
        select max(recorded_at) into lb from public.readings where sensor_id = s.id and recorded_at >= a.event_start and recorded_at <= p_now
           and public.temp_dev(value, lo, hi, r.tolerance_deg, s.zone_id, recorded_at) is not null;
        lb := coalesce(lb, a.event_start);
        if l.recorded_at - lb >= make_interval(mins => r.recovery_min) then
          select min(recorded_at) into v_rec from public.readings where sensor_id = s.id and recorded_at > lb and recorded_at <= p_now;
          perform public.close_alert(a.id, coalesce(v_rec, l.recorded_at), p_now);
        end if;
      end loop;
    end if;
  end loop;

  -- 2. sensors that went silent
  for s in select * from public.sensors where status in ('ACTIVE', 'OFFLINE') and not is_manual and deleted_at is null and last_seen_at is not null loop
    r := public.effective_rule(s.zone_id);
    continue when not r.enabled;
    if p_now - s.last_seen_at > make_interval(mins => r.offline_after_min) then
      v_id := public.open_alert('OFFLINE', 'WARNING', s.id, s.zone_id, s.last_seen_at, null, null, 0, p_now, 'no readings');
      if v_id is not null then v_opened := v_opened + 1; end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind = 'OFFLINE' and recovered_at is null loop perform public.close_alert(a.id, s.last_seen_at, p_now); end loop;
    end if;
  end loop;

  -- 3. door, power and compressor state sensors (door: 1 = open; power: 1 = mains on; compressor: 1 = running)
  for s in select * from public.sensors where type in ('DOOR', 'POWER', 'COMPRESSOR') and status <> 'RETIRED' and not is_manual and deleted_at is null and last_seen_at is not null loop
    r := public.effective_rule(s.zone_id);
    continue when not r.enabled;
    v_bad := case when s.type = 'DOOR' then 1 else 0 end;
    v_kind := case s.type when 'DOOR' then 'DOOR_OPEN' when 'POWER' then 'POWER_FAILURE' else 'COMPRESSOR_FAULT' end;
    select recorded_at, value into l from public.readings where sensor_id = s.id and recorded_at <= p_now order by recorded_at desc limit 1;
    continue when not found or p_now - l.recorded_at > make_interval(mins => r.offline_after_min);
    if l.value = v_bad then
      select max(recorded_at) into last_ok from public.readings where sensor_id = s.id and recorded_at > v_win and recorded_at <= p_now and value <> v_bad;
      select min(recorded_at) into v_start from public.readings where sensor_id = s.id and recorded_at > coalesce(last_ok, v_win) and recorded_at <= p_now;
      dur := greatest(floor(extract(epoch from p_now - v_start) / 60), 0)::integer;
      delay := case when s.type = 'DOOR' then r.door_open_after_min else 0 end;
      select * into a from public.alerts where sensor_id = s.id and kind = v_kind and recovered_at is null;
      if found then
        update public.alerts set duration_min = dur where id = a.id and duration_min is distinct from dur;
      elsif dur >= delay then
        v_id := public.open_alert(v_kind, (case when s.type = 'DOOR' then 'WARNING' else 'CRITICAL' end)::public.alert_severity, s.id, s.zone_id, v_start, null, null, 0, p_now,
                                  case s.type when 'DOOR' then 'door left open' when 'POWER' then 'power failure' else 'compressor fault' end);
        if v_id is not null then v_opened := v_opened + 1; end if;
      end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind = v_kind and recovered_at is null loop perform public.close_alert(a.id, l.recorded_at, p_now); end loop;
    end if;
  end loop;

  -- 4. humidity
  for s in select * from public.sensors where type = 'HUMIDITY' and status <> 'RETIRED' and not is_manual and deleted_at is null and last_seen_at is not null loop
    r := public.effective_rule(s.zone_id);
    continue when not r.enabled or (r.humidity_min is null and r.humidity_max is null);
    select recorded_at, value into l from public.readings where sensor_id = s.id and recorded_at <= p_now order by recorded_at desc limit 1;
    continue when not found or p_now - l.recorded_at > make_interval(mins => r.offline_after_min);
    if l.value < coalesce(r.humidity_min, -1) or l.value > coalesce(r.humidity_max, 101) then
      select max(recorded_at) into last_ok from public.readings where sensor_id = s.id and recorded_at > v_win and recorded_at <= p_now
         and value >= coalesce(r.humidity_min, -1) and value <= coalesce(r.humidity_max, 101);
      select min(recorded_at) into v_start from public.readings where sensor_id = s.id and recorded_at > coalesce(last_ok, v_win) and recorded_at <= p_now;
      dur := greatest(floor(extract(epoch from p_now - v_start) / 60), 0)::integer;
      select * into a from public.alerts where sensor_id = s.id and kind = 'HUMIDITY' and recovered_at is null;
      if found then update public.alerts set duration_min = dur where id = a.id and duration_min is distinct from dur;
      elsif dur >= r.humidity_delay_min then
        v_id := public.open_alert('HUMIDITY', 'WARNING', s.id, s.zone_id, v_start, case when l.value > coalesce(r.humidity_max, 101) then r.humidity_max else r.humidity_min end, l.value, 0, p_now, 'humidity out of range');
        if v_id is not null then v_opened := v_opened + 1; end if;
      end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind = 'HUMIDITY' and recovered_at is null loop perform public.close_alert(a.id, l.recorded_at, p_now); end loop;
    end if;
  end loop;

  -- 5. calibration due and battery low
  for s in select * from public.sensors where status <> 'RETIRED' and not is_manual and deleted_at is null loop
    r := public.effective_rule(s.zone_id);
    continue when not r.enabled;
    if s.calibration_due_at is not null and s.calibration_due_at <= (p_now at time zone 'Asia/Kolkata')::date + r.calibration_warn_days then
      v_id := public.open_alert('CALIBRATION_DUE', 'WARNING', s.id, s.zone_id, p_now, null, null, 0, p_now, 'calibration due ' || s.calibration_due_at);
      if v_id is not null then v_opened := v_opened + 1; end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind = 'CALIBRATION_DUE' and recovered_at is null loop perform public.close_alert(a.id, p_now, p_now); end loop;
    end if;
    if s.battery_pct is not null and s.battery_pct < r.battery_low_pct then
      v_id := public.open_alert('BATTERY_LOW', 'WARNING', s.id, s.zone_id, p_now, null, s.battery_pct, 0, p_now, 'battery ' || s.battery_pct || '%');
      if v_id is not null then v_opened := v_opened + 1; end if;
    else
      for a in select * from public.alerts where sensor_id = s.id and kind = 'BATTERY_LOW' and recovered_at is null loop perform public.close_alert(a.id, p_now, p_now); end loop;
    end if;
  end loop;

  -- 6. CRITICAL alerts nobody acknowledged go to the next person: staff -> manager -> administrator
  for a in select * from public.alerts where severity = 'CRITICAL' and status = 'OPEN' and escalation_level < 2 loop
    r := public.effective_rule(a.zone_id);
    if p_now - coalesce(a.escalated_at, a.opened_at) >= make_interval(mins => r.critical_ack_min) then
      update public.alerts set escalation_level = escalation_level + 1, escalated_at = p_now where id = a.id;
      perform public.notify_alert(a.id, a.escalation_level + 1, format('NOT ACKNOWLEDGED (escalation %s)', a.escalation_level + 1));
    end if;
  end loop;
  return v_opened;
end $$;

-- ---------- lifecycle: OPEN -> ACKNOWLEDGED -> RESOLVED ----------
create or replace function public.acknowledge_alert(p_alert_id uuid) returns void language plpgsql security definer set search_path = ''
as $$
declare a public.alerts;
begin
  select * into a from public.alerts where id = p_alert_id for update;
  if not found then raise exception 'Alert not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(a.warehouse_id) then raise exception 'Not allowed in this warehouse' using errcode = '42501'; end if;
  if a.status <> 'OPEN' then raise exception 'Alert is already %', a.status using errcode = 'WMS03'; end if;
  update public.alerts set status = 'ACKNOWLEDGED', acknowledged_by = auth.uid(), acknowledged_at = now() where id = a.id;
end $$;

create or replace function public.resolve_alert(p_alert_id uuid, p_cause text, p_action text, p_equipment_id uuid default null, p_create_task boolean default false, p_task_due date default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.alerts; v_task uuid;
begin
  select * into a from public.alerts where id = p_alert_id for update;
  if not found then raise exception 'Alert not found' using errcode = 'P0002'; end if;
  if not public.can_write_warehouse(a.warehouse_id) then raise exception 'Only an administrator or the warehouse manager can resolve alerts' using errcode = '42501'; end if;
  if a.status = 'RESOLVED' then raise exception 'Alert is already resolved' using errcode = 'WMS03'; end if;
  if coalesce(trim(p_cause), '') = '' or coalesce(trim(p_action), '') = '' then raise exception 'The cause and the action taken are required' using errcode = 'WMS08'; end if;
  if p_equipment_id is not null then
    if not exists (select 1 from public.equipment where id = p_equipment_id and warehouse_id = a.warehouse_id) then raise exception 'Equipment is not in this warehouse' using errcode = '22023'; end if;
    if p_create_task then
      insert into public.maintenance_tasks (equipment_id, title, due_date, alert_id) values (p_equipment_id, 'Repair after alert', coalesce(p_task_due, public.today_ist()), a.id) returning id into v_task;
    end if;
  end if;
  perform public.copy_alert_evidence(a.id, now());
  perform public.snapshot_alert_stock(a.id, now());
  update public.alerts set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now(), cause = p_cause, action_taken = p_action,
         acknowledged_by = coalesce(acknowledged_by, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now()),
         equipment_id = coalesce(p_equipment_id, equipment_id), maintenance_task_id = coalesce(v_task, maintenance_task_id) where id = a.id;
end $$;

create or replace function public.approve_client_notice(p_notice_id uuid, p_subject text default null, p_body text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare n public.client_notices; c public.clients; r record;
begin
  select * into n from public.client_notices where id = p_notice_id for update;
  if not found then raise exception 'Notice not found' using errcode = 'P0002'; end if;
  if not public.can_write_warehouse(n.warehouse_id) then raise exception 'Only an administrator or the warehouse manager can approve client notices' using errcode = '42501'; end if;
  if n.status <> 'DRAFT' then raise exception 'Notice is already %', n.status using errcode = 'WMS03'; end if;
  update public.client_notices set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(),
         subject = coalesce(nullif(trim(p_subject), ''), subject), body = coalesce(nullif(trim(p_body), ''), body) where id = n.id returning * into n;
  select * into c from public.clients where id = n.client_id;
  perform public.queue_message(null, c.email, c.phone, 'CLIENT_NOTICE', n.subject, n.body, n.alert_id);
  for r in select id from public.profiles where role = 'CLIENT' and client_id = n.client_id and is_active and deleted_at is null loop
    perform public.queue_message(r.id, null, null, 'CLIENT_NOTICE', n.subject, n.body, n.alert_id);
  end loop;
end $$;

create or replace function public.reject_client_notice(p_notice_id uuid) returns void language plpgsql security definer set search_path = ''
as $$
declare n public.client_notices;
begin
  select * into n from public.client_notices where id = p_notice_id for update;
  if not found or not public.can_write_warehouse(n.warehouse_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.client_notices set status = 'REJECTED', approved_by = auth.uid(), approved_at = now() where id = n.id and status = 'DRAFT';
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids)) $$;
