-- =====================================================================
-- Phase 4 part 4: RLS, grants, storage, audit, realtime and the cron schedule.
-- Admin sees everything; managers and staff their warehouses; staff cannot change rules, keys or calibration; a client sees only
-- readings of zones during the days its stock was there. The ingest function is the only writer of sensor readings. No accountant access.
-- =====================================================================
alter table public.sensors enable row level security;
alter table public.device_keys enable row level security;
alter table public.calibration_log enable row level security;
alter table public.readings enable row level security;
alter table public.readings_hourly enable row level security;
alter table public.equipment enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.alert_rules enable row level security;
alter table public.defrost_windows enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_evidence enable row level security;
alter table public.alert_stock enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.client_notices enable row level security;
alter table public.internal_secrets enable row level security;

-- may this client see a reading? Only inside the India calendar days of its allocations in that zone
create or replace function public.reading_visible_to_client(p_sensor_id uuid, p_ts timestamptz) returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_client() and exists (
    select 1 from public.slot_allocations a join public.sensors s on s.zone_id = a.zone_id
     where s.id = p_sensor_id and a.client_id = public.current_client_id() and not a.cancelled
       and (p_ts at time zone 'Asia/Kolkata')::date between a.start_date and coalesce(a.end_date, date '9998-12-31'))
$$;

-- sensors, rules, calibration: admin and the warehouse manager write; managers and staff read their warehouses
create policy sensors_select on public.sensors for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy sensors_insert on public.sensors for insert to authenticated with check (public.can_write_warehouse(warehouse_id) and not is_manual);
create policy sensors_update on public.sensors for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy device_keys_select on public.device_keys for select to authenticated using (public.is_admin());
create policy calibration_log_select on public.calibration_log for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy readings_select_staff on public.readings for select to authenticated using (exists (select 1 from public.sensors s where s.id = sensor_id));
create policy readings_select_client on public.readings for select to authenticated using (public.reading_visible_to_client(sensor_id, recorded_at));
create policy readings_hourly_select_staff on public.readings_hourly for select to authenticated using (exists (select 1 from public.sensors s where s.id = sensor_id));
create policy readings_hourly_select_client on public.readings_hourly for select to authenticated using (public.reading_visible_to_client(sensor_id, hour));
create policy alert_rules_select on public.alert_rules for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy alert_rules_insert on public.alert_rules for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy alert_rules_update on public.alert_rules for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy defrost_select on public.defrost_windows for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy defrost_insert on public.defrost_windows for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy defrost_update on public.defrost_windows for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy defrost_delete on public.defrost_windows for delete to authenticated using (public.can_write_warehouse(warehouse_id));
create policy equipment_select on public.equipment for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy equipment_insert on public.equipment for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy equipment_update on public.equipment for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy tasks_select on public.maintenance_tasks for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy tasks_insert on public.maintenance_tasks for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy tasks_update on public.maintenance_tasks for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));

-- alerts: warehouse people see theirs; a client sees an alert only when its own stock was affected
create or replace function public.client_affected_by_alert(p_alert_id uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_client() and exists (select 1 from public.alert_stock s where s.alert_id = p_alert_id and s.client_id = public.current_client_id()) $$;
create policy alerts_select on public.alerts for select to authenticated using (public.can_read_warehouse(warehouse_id) or public.client_affected_by_alert(id));
create policy alert_evidence_select on public.alert_evidence for select to authenticated using (exists (select 1 from public.alerts a where a.id = alert_id and public.can_read_warehouse(a.warehouse_id)));
create policy alert_stock_select on public.alert_stock for select to authenticated using (public.is_my_client(client_id)
  or exists (select 1 from public.alerts a where a.id = alert_id and public.can_read_warehouse(a.warehouse_id)));
create policy client_notices_select on public.client_notices for select to authenticated using (public.can_read_warehouse(warehouse_id) or (public.is_my_client(client_id) and status = 'APPROVED'));
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy outbox_select on public.notification_outbox for select to authenticated using (public.is_admin());

-- table grants: writes go through the functions above (or the policies for sensors, rules, equipment)
revoke all on public.internal_secrets, public.notification_outbox from anon, authenticated;
grant select on public.notification_outbox to authenticated;
revoke insert, update, delete on public.device_keys, public.calibration_log, public.readings, public.readings_hourly, public.alerts, public.alert_evidence, public.alert_stock,
  public.notifications, public.client_notices from authenticated;
revoke all on public.readings, public.readings_hourly, public.sensors, public.device_keys, public.calibration_log, public.alert_rules, public.defrost_windows, public.equipment,
  public.maintenance_tasks, public.alerts, public.alert_evidence, public.alert_stock, public.notifications, public.client_notices from anon;
revoke delete on public.sensors, public.alert_rules, public.equipment, public.maintenance_tasks from authenticated;
-- staff never write rules, sensors, equipment: the policies above already require can_write_warehouse (admin or the warehouse's manager)

-- storage: calibration certificates, manual-reading photos and maintenance photos live in one private bucket, first folder = warehouse id
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coldchain', 'coldchain', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) on conflict (id) do nothing;
create policy wms_coldchain_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'coldchain' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_operate_warehouse(((storage.foldername(name))[1])::uuid));
create policy wms_coldchain_select on storage.objects for select to authenticated
  using (bucket_id = 'coldchain' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_read_warehouse(((storage.foldername(name))[1])::uuid));

-- audit: rules, keys, calibration, sensors, equipment, alert changes (including resolutions) and client notices
do $$
declare t text;
begin
  foreach t in array array['sensors', 'device_keys', 'calibration_log', 'alert_rules', 'defrost_windows', 'alerts', 'equipment', 'maintenance_tasks', 'client_notices'] loop
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- realtime: the dashboard refreshes when sensors (last value) or alerts change
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sensors, public.alerts, public.notifications;
  end if;
end $$;

-- ---------- function privileges ----------
revoke execute on all functions in schema public from anon, public;
do $$
declare f text;
begin
  foreach f in array array[
    'ingest_readings(text, jsonb, timestamptz)', 'evaluate_alerts(timestamptz)', 'rollup_readings(timestamptz)', 'ensure_reading_partitions(integer, integer)',
    'maintenance_reminders(timestamptz)', 'dispatch_notifications()', 'open_alert(public.alert_kind, public.alert_severity, uuid, uuid, timestamptz, numeric, numeric, numeric, timestamptz, text)',
    'close_alert(uuid, timestamptz, timestamptz)', 'copy_alert_evidence(uuid, timestamptz)', 'snapshot_alert_stock(uuid, timestamptz)', 'notify_alert(uuid, integer, text)',
    'queue_message(uuid, text, text, text, text, text, uuid, uuid)', 'alert_recipients(uuid, integer)', 'set_internal_secret(text, text)', 'manual_sensor_for_zone(uuid)',
    'sensors_sync()', 'zone_children_sync()', 'equipment_children_sync()', 'cc(text, numeric)', 'effective_rule(uuid)', 'in_defrost(uuid, timestamptz)',
    'temp_dev(numeric, numeric, numeric, numeric, uuid, timestamptz)', 'affected_stock(uuid, timestamptz, timestamptz)'
  ] loop
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
end $$;

-- ---------- schedule (pg_cron runs in UTC; India time = UTC + 5:30) ----------
do $$ begin perform cron.unschedule('wms-evaluate-alerts'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('wms-readings-rollup'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('wms-maintenance-reminders'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('wms-notify-dispatch'); exception when others then null; end $$;
select cron.schedule('wms-evaluate-alerts', '* * * * *', $cron$select public.evaluate_alerts()$cron$);
select cron.schedule('wms-notify-dispatch', '* * * * *', $cron$select public.dispatch_notifications()$cron$);
select cron.schedule('wms-readings-rollup', '30 20 * * *', $cron$select public.rollup_readings()$cron$);           -- 02:00 India time
select cron.schedule('wms-maintenance-reminders', '30 2 * * *', $cron$select public.maintenance_reminders()$cron$);   -- 08:00 India time
