-- =====================================================================
-- Phase 4 part 3: roll-up, live overview, series, client compliance report, maintenance, notification dispatch.
-- =====================================================================
create extension if not exists pg_net;

-- ---------- roll-up: raw readings older than the retention window become hourly min / max / avg; alert evidence is copied first ----------
create or replace function public.rollup_readings(p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_days integer := greatest(public.cc('raw_retention_days', 30)::integer, public.cc('late_days', 7)::integer + 1); v_cut timestamptz; a record; v_ev integer := 0;
  v_hourly integer; v_del bigint := 0; v_old integer; p record; v_up timestamptz; v_parts integer := 0;
begin
  perform public.ensure_reading_partitions(2, 3);
  v_cut := date_trunc('hour', p_now - make_interval(days => v_days));
  -- evidence first: any alert whose evidence window reaches back before the cut-off keeps its raw rows forever
  for a in select id from public.alerts where event_start - make_interval(mins => public.cc('evidence_before_min', 30)::integer) < v_cut loop
    v_ev := v_ev + public.copy_alert_evidence(a.id, p_now);
  end loop;
  insert into public.readings_hourly (sensor_id, hour, min_value, max_value, avg_value, n)
  select sensor_id, date_trunc('hour', recorded_at), min(value), max(value), round(avg(value), 2), count(*)::integer
    from public.readings where recorded_at < v_cut group by sensor_id, date_trunc('hour', recorded_at)
  on conflict (sensor_id, hour) do update set min_value = least(public.readings_hourly.min_value, excluded.min_value),
    max_value = greatest(public.readings_hourly.max_value, excluded.max_value),
    avg_value = round((public.readings_hourly.avg_value * public.readings_hourly.n + excluded.avg_value * excluded.n) / (public.readings_hourly.n + excluded.n), 2),
    n = public.readings_hourly.n + excluded.n;
  get diagnostics v_hourly = row_count;
  delete from public.readings where recorded_at < v_cut;
  get diagnostics v_del = row_count;
  for p in select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_class pa on pa.oid = i.inhparent
           where pa.relname = 'readings' and pa.relnamespace = 'public'::regnamespace loop
    v_up := (make_date(substring(p.relname from 'y(\d{4})m')::integer, substring(p.relname from 'm(\d{2})$')::integer, 1) + interval '1 month')::timestamp at time zone 'UTC';
    if v_up <= v_cut then execute format('drop table public.%I', p.relname); v_parts := v_parts + 1; end if;
  end loop;
  delete from public.readings_hourly where hour < p_now - make_interval(days => public.cc('hourly_retention_days', 730)::integer);
  get diagnostics v_old = row_count;
  return jsonb_build_object('cutoff', v_cut, 'hourly_rows', v_hourly, 'raw_deleted', v_del, 'evidence_rows', v_ev, 'partitions_dropped', v_parts, 'hourly_expired', v_old);
end $$;

-- ---------- live overview: one row per zone ----------
create or replace function public.cold_chain_overview(p_warehouse_id uuid)
returns table (zone_id uuid, zone_code text, zone_name text, storage_type public.storage_type, temp_min numeric, temp_max numeric, current_value numeric, last_at timestamptz,
               sensor_count integer, manual_only boolean, offline_after_min integer, open_alerts integer, worst_severity text, spark jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_read_warehouse(p_warehouse_id) then raise exception 'Not allowed in this warehouse' using errcode = '42501'; end if;
  return query
  select z.id, z.code, z.name, z.storage_type, z.temp_min, z.temp_max,
    (select s.last_value from public.sensors s where s.zone_id = z.id and s.type = 'TEMPERATURE' and s.deleted_at is null and s.status <> 'RETIRED' and s.last_seen_at is not null order by s.last_seen_at desc limit 1),
    (select max(s.last_seen_at) from public.sensors s where s.zone_id = z.id and s.type = 'TEMPERATURE' and s.deleted_at is null and s.status <> 'RETIRED'),
    (select count(*)::integer from public.sensors s where s.zone_id = z.id and s.deleted_at is null and s.status <> 'RETIRED'),
    not exists (select 1 from public.sensors s where s.zone_id = z.id and s.deleted_at is null and s.status <> 'RETIRED' and not s.is_manual and s.type = 'TEMPERATURE'),
    (public.effective_rule(z.id)).offline_after_min,
    (select count(*)::integer from public.alerts a where a.zone_id = z.id and a.recovered_at is null and a.status <> 'RESOLVED'),
    (select case when count(*) = 0 then null when bool_or(a.severity = 'CRITICAL') then 'CRITICAL' else 'WARNING' end from public.alerts a where a.zone_id = z.id and a.recovered_at is null and a.status <> 'RESOLVED'
        and a.kind in ('TEMP_HIGH', 'TEMP_LOW', 'POWER_FAILURE', 'COMPRESSOR_FAULT', 'HUMIDITY', 'DOOR_OPEN')),
    (select jsonb_agg(jsonb_build_object('t', x.b, 'v', x.v) order by x.b) from (
        select date_bin('30 minutes', r.recorded_at, timestamptz 'epoch') b, round(avg(r.value), 1) v from public.readings r join public.sensors s on s.id = r.sensor_id
         where s.zone_id = z.id and s.type = 'TEMPERATURE' and r.recorded_at >= now() - interval '24 hours' group by 1) x)
  from public.zones z where z.warehouse_id = p_warehouse_id and z.deleted_at is null and z.is_active order by z.code;
end $$;

-- ---------- chart series (raw, or hourly once the raw rows were rolled up) ----------
create or replace function public.zone_series(p_zone_id uuid, p_from timestamptz, p_to timestamptz, p_bucket_min integer default 15)
returns table (bucket timestamptz, min_v numeric, max_v numeric, avg_v numeric, n integer)
language plpgsql stable security definer set search_path = ''
as $$
declare z public.zones; v_wh boolean; v_bin interval := make_interval(mins => greatest(p_bucket_min, 1)); v_hbin interval := make_interval(mins => greatest(p_bucket_min, 60));
begin
  select * into z from public.zones where id = p_zone_id and deleted_at is null;
  if not found then raise exception 'Zone not found' using errcode = 'P0002'; end if;
  v_wh := public.can_read_warehouse(z.warehouse_id);
  if not v_wh and not (public.is_client() and exists (select 1 from public.slot_allocations a where a.zone_id = p_zone_id and a.client_id = public.current_client_id() and not a.cancelled)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  with win as (select (a.start_date::timestamp at time zone 'Asia/Kolkata') t0, ((least(coalesce(a.end_date, date '9998-12-31'), date '9998-12-31') + 1)::timestamp at time zone 'Asia/Kolkata') t1
                 from public.slot_allocations a where not v_wh and a.zone_id = p_zone_id and a.client_id = public.current_client_id() and not a.cancelled),
  ss as (select s.id from public.sensors s where s.zone_id = p_zone_id and s.type = 'TEMPERATURE' and s.deleted_at is null),
  raw as (select date_bin(v_bin, r.recorded_at, timestamptz 'epoch') b, r.value v from public.readings r
           where r.sensor_id in (select id from ss) and r.recorded_at >= p_from and r.recorded_at < p_to
             and (v_wh or exists (select 1 from win w where r.recorded_at >= w.t0 and r.recorded_at < w.t1))),
  hr as (select date_bin(v_hbin, h.hour, timestamptz 'epoch') b, h.min_value mn, h.max_value mx, h.avg_value av, h.n from public.readings_hourly h
          where h.sensor_id in (select id from ss) and h.hour >= p_from and h.hour < p_to
            and (v_wh or exists (select 1 from win w where h.hour >= w.t0 and h.hour < w.t1)))
  select x.b, x.mn, x.mx, x.av, x.n from (
    select raw.b, min(raw.v) mn, max(raw.v) mx, round(avg(raw.v), 2) av, count(*)::integer n from raw group by raw.b
    union all
    select hr.b, min(hr.mn), max(hr.mx), round(sum(hr.av * hr.n) / sum(hr.n), 2), sum(hr.n)::integer from hr group by hr.b) x order by x.b;
end $$;

-- ---------- client compliance: min / max / average / time out of range for exactly the periods and places their stock was there ----------
create or replace function public.client_temperature_report(p_client_id uuid, p_from date, p_to date)
returns table (zone_id uuid, zone_code text, zone_name text, temp_min numeric, temp_max numeric, slots text[], brigades integer, from_date date, to_date date,
               min_c numeric, max_c numeric, avg_c numeric, readings integer, minutes_out numeric, minutes_covered numeric, minutes_period numeric, approx boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare v_gap numeric := public.cc('gap_cap_min', 15);
begin
  if public.is_accountant() or not public.can_see_client(p_client_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with per as (
    select a.zone_id zid, a.start_date, a.end_date, array_agg(distinct s.code order by s.code) slots, count(*)::integer brigades
      from public.slot_allocations a join public.brigade_slots s on s.id = a.slot_id
     where a.client_id = p_client_id and not a.cancelled and a.start_date <= p_to and coalesce(a.end_date, p_to) >= p_from
       and (not public.is_client() or public.is_my_client(p_client_id))
     group by a.zone_id, a.start_date, a.end_date),
  p2 as (
    select row_number() over () pk, per.*, z.code zc, z.name zn, z.temp_min zmin, z.temp_max zmax,
           greatest(per.start_date, p_from) d0, least(coalesce(per.end_date, p_to), p_to) d1,
           (greatest(per.start_date, p_from)::timestamp at time zone 'Asia/Kolkata') t0,
           ((least(coalesce(per.end_date, p_to), p_to) + 1)::timestamp at time zone 'Asia/Kolkata') t1
      from per join public.zones z on z.id = per.zid),
  obs as (
    select p2.pk, rd.sensor_id, rd.value, rd.recorded_at,
           least(coalesce(extract(epoch from lead(rd.recorded_at) over (partition by p2.pk, rd.sensor_id order by rd.recorded_at) - rd.recorded_at) / 60, v_gap), v_gap) dur,
           (rd.value > p2.zmax or rd.value < p2.zmin) is true as is_out
      from p2 join public.sensors se on se.zone_id = p2.zid and se.type = 'TEMPERATURE' and se.deleted_at is null
      join public.readings rd on rd.sensor_id = se.id and rd.recorded_at >= p2.t0 and rd.recorded_at < p2.t1),
  ra as (select pk, min(value) mn, max(value) mx, sum(value) sm, count(*) c, sum(case when is_out then dur else 0 end) mo, sum(dur) mc from obs group by pk),
  ha as (select p2.pk, min(h.min_value) mn, max(h.max_value) mx, sum(h.avg_value * h.n) sm, sum(h.n) c,
                sum(case when h.avg_value > p2.zmax or h.avg_value < p2.zmin then 60 else 0 end) mo, count(*) * 60 mc
           from p2 join public.sensors se on se.zone_id = p2.zid and se.type = 'TEMPERATURE' and se.deleted_at is null
           join public.readings_hourly h on h.sensor_id = se.id and h.hour >= p2.t0 and h.hour < p2.t1 group by p2.pk)
  select p2.zid, p2.zc, p2.zn, p2.zmin, p2.zmax, p2.slots, p2.brigades, p2.d0, p2.d1,
         least(ra.mn, ha.mn), greatest(ra.mx, ha.mx),
         case when coalesce(ra.c, 0) + coalesce(ha.c, 0) = 0 then null else round((coalesce(ra.sm, 0) + coalesce(ha.sm, 0)) / (coalesce(ra.c, 0) + coalesce(ha.c, 0)), 2) end,
         (coalesce(ra.c, 0) + coalesce(ha.c, 0))::integer, round(coalesce(ra.mo, 0) + coalesce(ha.mo, 0), 1), round(coalesce(ra.mc, 0) + coalesce(ha.mc, 0), 1),
         round(extract(epoch from p2.t1 - p2.t0) / 60, 0), ha.pk is not null
    from p2 left join ra on ra.pk = p2.pk left join ha on ha.pk = p2.pk order by p2.zc, p2.d0;
end $$;

create or replace function public.client_lorry_temps(p_client_id uuid, p_from date, p_to date)
returns table (doc_type text, doc_no text, at timestamptz, lorry_number text, temp_c numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.is_accountant() or not public.can_see_client(p_client_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select 'INWARD_RECEIPT', r.receipt_no, r.received_at, g.lorry_number, g.lorry_temp_c from public.inward_receipts r join public.gate_entries g on g.id = r.gate_entry_id
   where r.client_id = p_client_id and r.status = 'CONFIRMED' and (r.received_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  union all
  select 'DELIVERY_CHALLAN', c.challan_no, c.dispatched_at, g.lorry_number, c.dispatch_temp_c from public.delivery_challans c join public.gate_entries g on g.id = c.gate_entry_id
   where c.client_id = p_client_id and c.status = 'CONFIRMED' and (c.dispatched_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  order by 3;
end $$;

-- ---------- maintenance ----------
create or replace function public.complete_maintenance_task(p_task_id uuid, p_notes text default null, p_photos text[] default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare t public.maintenance_tasks; e public.equipment; v_today date := public.today_ist();
begin
  select * into t from public.maintenance_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(t.warehouse_id) then raise exception 'Not allowed in this warehouse' using errcode = '42501'; end if;
  if t.status in ('DONE', 'CANCELLED') then raise exception 'Task is already %', t.status using errcode = 'WMS03'; end if;
  update public.maintenance_tasks set status = 'DONE', completed_at = now(), completed_by = auth.uid(), notes = coalesce(p_notes, notes), photos = coalesce(p_photos, photos) where id = t.id;
  select * into e from public.equipment where id = t.equipment_id for update;
  update public.equipment set last_service_on = v_today where id = e.id;
  if e.service_interval_days is not null and not exists (select 1 from public.maintenance_tasks m where m.equipment_id = e.id and m.status in ('OPEN', 'IN_PROGRESS') and m.id <> t.id and m.alert_id is null) then
    insert into public.maintenance_tasks (equipment_id, title, due_date, assigned_to) values (e.id, 'Scheduled service', v_today + e.service_interval_days, t.assigned_to);
    update public.equipment set next_service_due = v_today + e.service_interval_days where id = e.id;
  end if;
end $$;

create or replace function public.update_maintenance_task(p_task_id uuid, p_status public.task_status, p_notes text default null, p_photos text[] default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare t public.maintenance_tasks;
begin
  select * into t from public.maintenance_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(t.warehouse_id) then raise exception 'Not allowed in this warehouse' using errcode = '42501'; end if;
  if p_status = 'DONE' then perform public.complete_maintenance_task(p_task_id, p_notes, p_photos); return; end if;
  if p_status = 'CANCELLED' and not public.can_write_warehouse(t.warehouse_id) then raise exception 'Only a manager can cancel a task' using errcode = '42501'; end if;
  update public.maintenance_tasks set status = p_status, notes = coalesce(p_notes, notes), photos = coalesce(p_photos, photos) where id = t.id;
end $$;

-- 7 days and 1 day before the due date: in-app notice and email to the assignee and the warehouse managers
create or replace function public.maintenance_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path = ''
as $$
declare t record; v_today date := (p_now at time zone 'Asia/Kolkata')::date; v_n integer := 0; r record; v_days integer; v_title text;
begin
  for t in select m.*, e.name ename from public.maintenance_tasks m join public.equipment e on e.id = m.equipment_id
            where m.status in ('OPEN', 'IN_PROGRESS') and m.due_date - v_today between 0 and 7 and (not m.reminded_7 or not m.reminded_1) loop
    v_days := t.due_date - v_today;
    if (v_days <= 1 and not t.reminded_1) or (v_days > 1 and not t.reminded_7) then
      v_title := format('Maintenance due %s: %s - %s', case v_days when 0 then 'today' when 1 then 'tomorrow' else 'in ' || v_days || ' days' end, t.ename, t.title);
      for r in select p.id, p.email, p.phone from public.profiles p where p.is_active and p.deleted_at is null and (p.id = t.assigned_to or (p.role = 'WAREHOUSE_MANAGER'
                 and exists (select 1 from public.warehouse_managers w where w.user_id = p.id and w.warehouse_id = t.warehouse_id and w.deleted_at is null))) loop
        perform public.queue_message(r.id, r.email, r.phone, 'MAINTENANCE', v_title, format('Due %s.', t.due_date), null, t.id); v_n := v_n + 1;
      end loop;
      update public.maintenance_tasks set reminded_7 = reminded_7 or v_days <= 7, reminded_1 = reminded_1 or v_days <= 1 where id = t.id;
    end if;
  end loop;
  return v_n;
end $$;

-- ---------- hand the outbox to the notify-alert Edge Function (needs functions_url and cron_secret in internal_secrets) ----------
create or replace function public.dispatch_notifications() returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_url text := (select value from public.internal_secrets where key = 'functions_url'); v_sec text := (select value from public.internal_secrets where key = 'cron_secret');
begin
  if v_url is null or v_sec is null or not exists (select 1 from public.notification_outbox where status = 'PENDING') then return false; end if;
  perform net.http_post(url := v_url || '/notify-alert', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_sec), body := '{}'::jsonb);
  return true;
exception when others then return false;
end $$;
