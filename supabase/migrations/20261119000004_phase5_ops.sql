-- =====================================================================
-- Phase 5 / 3: dashboards, report indexes, cron health, rate limits, retention, imports, backup hooks.
-- =====================================================================

-- ---------- indexes for reports (100,000-row tables) ----------
create index if not exists stock_items_client_expiry_idx on public.stock_items (client_id, expiry_date) where deleted_at is null and quantity > 0;
create index if not exists stock_items_wh_live_idx on public.stock_items (warehouse_id, zone_id) where deleted_at is null and quantity > 0;
create index if not exists stock_movements_created_idx on public.stock_movements (warehouse_id, created_at desc);
create index if not exists labour_entries_wh_created_idx on public.labour_entries (warehouse_id, created_at);
create index if not exists inward_receipts_wh_received_idx on public.inward_receipts (warehouse_id, received_at desc) where deleted_at is null;
create index if not exists delivery_challans_wh_dispatched_idx on public.delivery_challans (warehouse_id, dispatched_at desc) where deleted_at is null;
create index if not exists invoices_client_date_idx on public.invoices (client_id, invoice_date desc);
create index if not exists invoices_status_date_idx on public.invoices (status, invoice_date);
create index if not exists payments_client_paid_idx on public.payments (client_id, paid_on desc);
create index if not exists alerts_wh_open_idx on public.alerts (warehouse_id, status) where recovered_at is null;
create index if not exists audit_logs_changed_idx on public.audit_logs (changed_at desc);
create index if not exists audit_logs_table_idx on public.audit_logs (table_name, changed_at desc);
create index if not exists gate_entries_wh_status_idx on public.gate_entries (warehouse_id, status, gate_in_at desc) where deleted_at is null;
create index if not exists slot_allocations_client_idx on public.slot_allocations (client_id) where end_date is null and not cancelled;

-- ---------- cron job log and health ----------
create table public.cron_job_state (
  job text primary key, last_started_at timestamptz, last_ok_at timestamptz, last_status text, last_error text,
  runs bigint not null default 0, failures bigint not null default 0, max_age_minutes integer not null default 1560
);
create table public.cron_job_runs (
  id bigint generated always as identity primary key, job text not null, started_at timestamptz not null default now(),
  finished_at timestamptz, status text not null default 'RUNNING' check (status in ('RUNNING', 'OK', 'FAILED')), error text, duration_ms integer
);
create index cron_job_runs_job_idx on public.cron_job_runs (job, started_at desc);

create or replace function public.cron_run(p_job text, p_sql text, p_log boolean default true, p_max_age integer default 1560) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id bigint; t0 timestamptz := clock_timestamp(); ms integer;
begin
  insert into public.cron_job_state (job, last_started_at, last_status, max_age_minutes, runs) values (p_job, now(), 'RUNNING', p_max_age, 1)
  on conflict (job) do update set last_started_at = now(), last_status = 'RUNNING', max_age_minutes = p_max_age, runs = public.cron_job_state.runs + 1;
  if p_log then insert into public.cron_job_runs (job) values (p_job) returning id into v_id; end if;
  begin
    execute p_sql;
    ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
    update public.cron_job_state set last_ok_at = now(), last_status = 'OK', last_error = null where job = p_job;
    if v_id is not null then update public.cron_job_runs set status = 'OK', finished_at = now(), duration_ms = ms where id = v_id; end if;
  exception when others then
    ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
    update public.cron_job_state set last_status = 'FAILED', last_error = left(sqlerrm, 500), failures = failures + 1 where job = p_job;
    if v_id is null then insert into public.cron_job_runs (job, status, error, finished_at, duration_ms) values (p_job, 'FAILED', left(sqlerrm, 500), now(), ms);
    else update public.cron_job_runs set status = 'FAILED', error = left(sqlerrm, 500), finished_at = now(), duration_ms = ms where id = v_id; end if;
  end;
end $$;

create or replace function public.cron_health() returns table (job text, status text, last_ok_at timestamptz, last_error text, stale boolean)
language sql stable security definer set search_path = '' as $$
  select s.job, s.last_status, s.last_ok_at, s.last_error, (s.last_ok_at < now() - make_interval(mins => s.max_age_minutes)) as stale
  from public.cron_job_state s where public.is_admin()
    and (s.last_status = 'FAILED' or (s.last_ok_at is not null and s.last_ok_at < now() - make_interval(mins => s.max_age_minutes)))
  order by s.job $$;

-- expected jobs that have never run yet are listed so a missing job is also a warning
insert into public.cron_job_state (job, max_age_minutes) values
  ('wms-evaluate-alerts', 10), ('wms-notify-dispatch', 10), ('wms-occupancy-snapshot', 1560), ('wms-mark-overdue', 1560), ('wms-generate-invoices', 1560),
  ('wms-readings-rollup', 1560), ('wms-maintenance-reminders', 1560), ('wms-backup-export', 1560), ('wms-cleanup', 1560)
on conflict (job) do nothing;

-- ---------- rate limiting (used by Edge Functions through the service role) ----------
create table public.rate_limits (key text not null, window_start timestamptz not null, hits integer not null default 0, primary key (key, window_start));
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); n integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1 returning hits into n;
  return n <= p_max;
end $$;

-- ---------- retention settings and the clean-up job ----------
insert into public.app_settings (key, value, description) values
  ('retention', '{"notifications_days": 180, "outbox_days": 90, "cron_runs_days": 60, "rate_limit_days": 2, "soft_deleted_days": 365}', 'Days to keep operational data. Financial records are never deleted.'),
  ('security', '{"require_admin_mfa": false}', 'Require two-factor sign-in for SUPER_ADMIN')
on conflict (key) do nothing;

create or replace function public.cleanup_old_data() returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb := coalesce((select value from public.app_settings where key = 'retention'), '{}'::jsonb); n integer; res jsonb := '{}'::jsonb; d integer;
begin
  d := coalesce((r ->> 'notifications_days')::int, 180);
  delete from public.notifications where created_at < now() - make_interval(days => d) and read_at is not null; get diagnostics n = row_count; res := res || jsonb_build_object('notifications', n);
  d := coalesce((r ->> 'outbox_days')::int, 90);
  delete from public.notification_outbox where created_at < now() - make_interval(days => d) and status <> 'PENDING'; get diagnostics n = row_count; res := res || jsonb_build_object('outbox', n);
  d := coalesce((r ->> 'cron_runs_days')::int, 60);
  delete from public.cron_job_runs where started_at < now() - make_interval(days => d); get diagnostics n = row_count; res := res || jsonb_build_object('cron_runs', n);
  d := coalesce((r ->> 'rate_limit_days')::int, 2);
  delete from public.rate_limits where window_start < now() - make_interval(days => d); get diagnostics n = row_count; res := res || jsonb_build_object('rate_limits', n);
  d := coalesce((r ->> 'soft_deleted_days')::int, 365);
  delete from public.client_contacts where deleted_at is not null and deleted_at < now() - make_interval(days => d); get diagnostics n = row_count; res := res || jsonb_build_object('client_contacts', n);
  return res;
end $$;

-- nothing financial is ever hard-deleted (or any document a client could be shown)
create or replace function public.forbid_hard_delete() returns trigger language plpgsql set search_path = '' as $$
begin raise exception '% records cannot be deleted', tg_table_name using errcode = 'WMS59'; end $$;
do $$ declare t text; begin
  foreach t in array array['invoices', 'invoice_lines', 'payments', 'payment_allocations', 'adjustment_notes', 'adjustment_note_lines', 'opening_balances', 'inward_receipts', 'delivery_challans'] loop
    if not exists (select 1 from pg_trigger where tgrelid = ('public.' || t)::regclass and tgname = 'zz_forbid_hard_delete') then
      execute format('create trigger zz_forbid_hard_delete before delete on public.%I for each row execute function public.forbid_hard_delete()', t);
    end if;
  end loop;
end $$;

-- ---------- dashboards ----------
create or replace function public.admin_dashboard() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', public.today_ist())::date; d jsonb; exp_days integer := coalesce((select value #>> '{}' from public.app_settings where key = 'expiry_alert_days')::int, 30);
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  select jsonb_build_object(
    'occupancy', (select coalesce(jsonb_agg(x order by x ->> 'warehouse', x ->> 'zone'), '[]') from (
        select jsonb_build_object('warehouse_id', w.id, 'warehouse', w.code, 'zone_id', z.id, 'zone', z.code, 'zone_name', z.name, 'slots', count(s.id),
          'occupied', count(s.id) filter (where s.status = 'OCCUPIED'), 'reserved', count(s.id) filter (where s.status = 'RESERVED')) x
        from public.brigade_slots s join public.zones z on z.id = s.zone_id join public.warehouses w on w.id = s.warehouse_id
        where s.deleted_at is null and w.deleted_at is null group by w.id, w.code, z.id, z.code, z.name) q),
    'revenue', (select jsonb_build_object('rent_paise', coalesce(sum(rent_taxable_paise), 0), 'labour_paise', coalesce(sum(labour_taxable_paise), 0), 'other_paise', coalesce(sum(other_taxable_paise), 0))
        from public.invoices where status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and invoice_date >= m0),
    'outstanding_paise', (select coalesce(sum(grand_total_paise - paid_paise - credit_paise), 0) from public.invoices where status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')),
    'top_clients', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('client_id', c.id, 'name', c.company_name, 'taxable_paise', sum(i.taxable_paise)) x
        from public.invoices i join public.clients c on c.id = i.client_id where i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.invoice_date >= public.today_ist() - 90
        group by c.id, c.company_name order by sum(i.taxable_paise) desc limit 5) q),
    'expiring', (select jsonb_build_object('lines', count(*), 'days', exp_days) from public.stock_items where deleted_at is null and quantity > 0 and expiry_date between public.today_ist() and public.today_ist() + exp_days),
    'open_alerts', (select jsonb_build_object('total', count(*), 'critical', count(*) filter (where severity = 'CRITICAL')) from public.alerts where recovered_at is null and status <> 'RESOLVED'),
    'sensors_offline', (select count(*) from public.sensors where deleted_at is null and status = 'ACTIVE' and not is_manual and (last_seen_at is null or last_seen_at < now() - interval '15 minutes')),
    'maintenance_due', (select count(*) from public.maintenance_tasks where status in ('OPEN', 'IN_PROGRESS') and due_date <= public.today_ist() + 14),
    'cron_warnings', (select coalesce(jsonb_agg(jsonb_build_object('job', job, 'status', status, 'last_ok_at', last_ok_at, 'error', last_error)), '[]') from public.cron_health()),
    'no_manager', (select coalesce(jsonb_agg(code), '[]') from public.warehouse_manager_counts where managers = 0),
    'pending_change_requests', (select count(*) from public.client_change_requests where status = 'PENDING')
  ) into d;
  return d;
end $$;

create or replace function public.manager_dashboard(p_warehouse_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d jsonb; today date := public.today_ist();
begin
  if not public.can_write_warehouse(p_warehouse_id) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  select jsonb_build_object(
    'expected_lorries', (select coalesce(jsonb_agg(x order by x ->> 'when'), '[]') from (
        select jsonb_build_object('kind', 'INWARD', 'when', b.from_date, 'client', c.company_name, 'ref', b.booking_no) x from public.space_bookings b join public.clients c on c.id = b.client_id
          where b.warehouse_id = p_warehouse_id and b.status = 'APPROVED' and b.from_date = today and b.deleted_at is null
        union all select jsonb_build_object('kind', 'OUTWARD', 'when', r.requested_date, 'client', c.company_name, 'ref', r.request_no) from public.dispatch_requests r join public.clients c on c.id = r.client_id
          where r.warehouse_id = p_warehouse_id and r.status in ('APPROVED', 'PICKING') and r.requested_date = today and r.deleted_at is null) q),
    'pending_receipts', (select count(*) from public.gate_entries where warehouse_id = p_warehouse_id and direction = 'INWARD' and status in ('AT_GATE', 'UNLOADING') and deleted_at is null),
    'pending_dispatches', (select count(*) from public.dispatch_requests where warehouse_id = p_warehouse_id and status in ('REQUESTED', 'APPROVED', 'PICKING') and deleted_at is null),
    'staff_on_shift', (select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'name', p.full_name, 'check_in_at', a.check_in_at)), '[]')
        from public.attendance a join public.profiles p on p.id = a.user_id where a.warehouse_id = p_warehouse_id and a.work_date = today and a.check_in_at is not null and a.check_out_at is null),
    'open_alerts', (select jsonb_build_object('total', count(*), 'critical', count(*) filter (where severity = 'CRITICAL')) from public.alerts where warehouse_id = p_warehouse_id and recovered_at is null and status <> 'RESOLVED'),
    'tasks', (select count(*) from public.maintenance_tasks where warehouse_id = p_warehouse_id and status in ('OPEN', 'IN_PROGRESS') and due_date <= today + 7),
    'pending_corrections', (select count(*) from public.attendance where warehouse_id = p_warehouse_id and correction_status = 'PENDING'),
    'open_tickets', (select count(*) from public.support_tickets where warehouse_id = p_warehouse_id and status in ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT'))
  ) into d;
  return d;
end $$;

create or replace function public.client_dashboard(p_client_id uuid default null) returns jsonb language plpgsql stable set search_path = '' as $$
declare cid uuid := coalesce(p_client_id, public.current_client_id()); today date := public.today_ist(); d jsonb; exp_days integer := coalesce((select value #>> '{}' from public.app_settings where key = 'expiry_alert_days')::int, 30);
begin
  if cid is null then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'brigades_held', (select count(*) from public.slot_allocations a where a.client_id = cid and not a.cancelled and a.start_date <= today and (a.end_date is null or a.end_date >= today)),
    'stock_by_band', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('band', coalesce(storage_type::text, 'DRY'), 'lines', count(*), 'quantity', sum(quantity), 'weight_kg', sum(weight_kg)) x
        from public.stock_items where client_id = cid and deleted_at is null and quantity > 0 group by storage_type order by 1) q),
    'expiring', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('id', id, 'item', item_name, 'batch', batch_no, 'expiry', expiry_date, 'quantity', quantity, 'unit', unit) x
        from public.stock_items where client_id = cid and deleted_at is null and quantity > 0 and expiry_date between today and today + exp_days order by expiry_date limit 10) q),
    'open_requests', jsonb_build_object(
        'bookings', (select count(*) from public.space_bookings where client_id = cid and status = 'REQUESTED' and deleted_at is null),
        'dispatch', (select count(*) from public.dispatch_requests where client_id = cid and status in ('REQUESTED', 'APPROVED', 'PICKING') and deleted_at is null),
        'tickets', (select count(*) from public.support_tickets where client_id = cid and status in ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT')),
        'changes', (select count(*) from public.client_change_requests where client_id = cid and status = 'PENDING')),
    'outstanding_paise', (select coalesce(sum(grand_total_paise - paid_paise - credit_paise), 0) from public.invoices where client_id = cid and status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE'))
        + coalesce((select sum(grand_total_paise - paid_paise) from public.adjustment_notes where client_id = cid and kind = 'DEBIT'), 0)
        + coalesce((select amount_paise from public.opening_balances where client_id = cid), 0),
    'recent_documents', (select coalesce(jsonb_agg(x order by x ->> 'date' desc), '[]') from (
        (select jsonb_build_object('type', 'RECEIPT', 'id', id, 'no', receipt_no, 'date', received_at::date) x from public.inward_receipts where client_id = cid and status = 'CONFIRMED' order by received_at desc limit 3)
        union all (select jsonb_build_object('type', 'CHALLAN', 'id', id, 'no', challan_no, 'date', dispatched_at::date) from public.delivery_challans where client_id = cid and status = 'CONFIRMED' order by dispatched_at desc limit 3)
        union all (select jsonb_build_object('type', 'INVOICE', 'id', id, 'no', invoice_no, 'date', invoice_date) from public.invoices where client_id = cid and status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') order by invoice_date desc limit 3)) q),
    'active_alerts', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('id', a.id, 'kind', a.kind, 'severity', a.severity, 'since', a.event_start, 'status', a.status) x
        from public.alerts a where a.recovered_at is null and a.status <> 'RESOLVED' and exists (select 1 from public.alert_stock s where s.alert_id = a.id and s.client_id = cid) order by a.event_start desc limit 10) q)
  ) into d;
  return d;
end $$;

-- ---------- imports: dry-run preview with an error report; all or nothing ----------
create or replace function public.import_rows(p_kind text, p_rows jsonb, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb; i integer := 0; errs jsonb := '[]'::jsonb; ok integer := 0; msg text; c public.clients; w public.warehouses; s public.brigade_slots; z public.zones; v_item uuid; v_unit_w numeric; v_qty numeric;
  st public.storage_type; cond public.stock_condition; v_gst text; v_amt bigint;
begin
  if not public.is_admin() then raise exception 'Only an administrator can import data' using errcode = 'WMS03'; end if;
  if p_kind not in ('clients', 'companies', 'opening_stock', 'opening_balances') then raise exception 'Unknown import kind' using errcode = 'WMS57'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'The file has no rows' using errcode = 'WMS57'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'At most 5000 rows per import' using errcode = 'WMS57'; end if;
  begin
    for rec in select e from jsonb_array_elements(p_rows) e loop
      i := i + 1;
      begin
        if p_kind = 'clients' then
          if coalesce(trim(rec ->> 'company_name'), '') = '' then raise exception 'company_name: required'; end if;
          v_gst := nullif(upper(trim(rec ->> 'gstin')), '');
          if v_gst is not null and not public.is_valid_gstin(v_gst) then raise exception 'gstin: % is not a valid GSTIN', v_gst; end if;
          if exists (select 1 from public.clients where lower(company_name) = lower(trim(rec ->> 'company_name')) and deleted_at is null) then raise exception 'company_name: already exists'; end if;
          if v_gst is not null and exists (select 1 from public.clients where gstin = v_gst and deleted_at is null) then raise exception 'gstin: already used by another client'; end if;
          insert into public.clients (company_name, gstin, pan, contact_name, phone, email, address_line1, city, district, state, state_code, pincode, credit_limit_paise)
          values (trim(rec ->> 'company_name'), v_gst, nullif(upper(trim(rec ->> 'pan')), ''), nullif(trim(rec ->> 'contact_name'), ''), nullif(trim(rec ->> 'phone'), ''),
                  nullif(trim(rec ->> 'email'), ''), nullif(trim(rec ->> 'address_line1'), ''), nullif(trim(rec ->> 'city'), ''), nullif(trim(rec ->> 'district'), ''),
                  nullif(trim(rec ->> 'state'), ''), coalesce(nullif(trim(rec ->> 'state_code'), ''), substr(v_gst, 1, 2)), nullif(trim(rec ->> 'pincode'), ''),
                  round(coalesce(nullif(rec ->> 'credit_limit_rupees', '')::numeric, 0) * 100)::bigint);
        else
          select * into c from public.clients where upper(code) = upper(trim(rec ->> 'client_code')) and deleted_at is null;
          if c.id is null then raise exception 'client_code: % not found', coalesce(rec ->> 'client_code', ''); end if;
          if p_kind = 'companies' then
            if coalesce(trim(rec ->> 'name'), '') = '' then raise exception 'name: required'; end if;
            v_gst := nullif(upper(trim(rec ->> 'gstin')), '');
            if v_gst is not null and not public.is_valid_gstin(v_gst) then raise exception 'gstin: % is not a valid GSTIN', v_gst; end if;
            insert into public.company_master (client_id, kind, name, gstin, city, state, state_code, pincode, contact_name, phone, email)
            values (c.id, coalesce(nullif(upper(trim(rec ->> 'kind')), ''), 'BOTH')::public.company_kind, trim(rec ->> 'name'), v_gst, nullif(trim(rec ->> 'city'), ''), nullif(trim(rec ->> 'state'), ''),
                    coalesce(nullif(trim(rec ->> 'state_code'), ''), substr(v_gst, 1, 2)), nullif(trim(rec ->> 'pincode'), ''), nullif(trim(rec ->> 'contact_name'), ''), nullif(trim(rec ->> 'phone'), ''), nullif(trim(rec ->> 'email'), ''));
          elsif p_kind = 'opening_balances' then
            if coalesce(rec ->> 'amount_rupees', '') !~ '^-?[0-9]+(\.[0-9]{1,2})?$' then raise exception 'amount_rupees: a number with at most 2 decimals is required'; end if;
            if coalesce(rec ->> 'as_of', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'as_of: date must be YYYY-MM-DD'; end if;
            if exists (select 1 from public.opening_balances where client_id = c.id) then raise exception 'client_code: opening balance already set'; end if;
            v_amt := round((rec ->> 'amount_rupees')::numeric * 100)::bigint;
            insert into public.opening_balances (client_id, as_of, amount_paise, notes) values (c.id, (rec ->> 'as_of')::date, v_amt, nullif(trim(rec ->> 'notes'), ''));
          else -- opening_stock
            select * into s from public.brigade_slots where upper(code) = upper(trim(rec ->> 'slot_code')) and deleted_at is null;
            if s.id is null then raise exception 'slot_code: % not found', coalesce(rec ->> 'slot_code', ''); end if;
            if coalesce(trim(rec ->> 'item_name'), '') = '' then raise exception 'item_name: required'; end if;
            if coalesce(trim(rec ->> 'unit'), '') = '' then raise exception 'unit: required'; end if;
            if coalesce(rec ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$' or (rec ->> 'quantity')::numeric <= 0 then raise exception 'quantity: a positive number is required'; end if;
            v_qty := (rec ->> 'quantity')::numeric;
            v_unit_w := coalesce(nullif(rec ->> 'unit_weight_kg', '')::numeric, 0);
            st := nullif(upper(trim(rec ->> 'storage_type')), '')::public.storage_type;
            cond := coalesce(nullif(upper(trim(rec ->> 'condition')), ''), 'GOOD')::public.stock_condition;
            if nullif(rec ->> 'expiry_date', '') is not null and (rec ->> 'expiry_date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'expiry_date: date must be YYYY-MM-DD'; end if;
            if nullif(rec ->> 'mfg_date', '') is not null and (rec ->> 'mfg_date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'mfg_date: date must be YYYY-MM-DD'; end if;
            s := public.occupy_slot(s.id, c.id, s.warehouse_id, st, nullif(rec ->> 'required_temp_c', '')::numeric, round(v_qty * v_unit_w, 3), 'OPENING_STOCK', null, public.today_ist());
            insert into public.stock_items (client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, sku, batch_no, mfg_date, expiry_date, unit, quantity, packages, unit_weight_kg, weight_kg,
                                            condition, storage_type, required_temp_c, received_at)
            values (c.id, s.warehouse_id, s.zone_id, s.id, s.code, trim(rec ->> 'item_name'), nullif(trim(rec ->> 'sku'), ''), nullif(trim(rec ->> 'batch_no'), ''),
                    nullif(rec ->> 'mfg_date', '')::date, nullif(rec ->> 'expiry_date', '')::date, trim(rec ->> 'unit'), v_qty, coalesce(nullif(rec ->> 'packages', '')::int, 0), v_unit_w,
                    round(v_qty * v_unit_w, 3), cond, st, nullif(rec ->> 'required_temp_c', '')::numeric, now())
            returning id into v_item;
            insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, to_slot_id, qty_delta, weight_delta, document_type, reason)
            values ('IN', v_item, c.id, s.warehouse_id, s.id, v_qty, round(v_qty * v_unit_w, 3), 'OPENING_STOCK', 'Opening stock import');
          end if;
        end if;
        ok := ok + 1;
      exception when others then
        msg := sqlerrm;
        errs := errs || jsonb_build_object('row', i, 'column', nullif(split_part(msg, ':', 1), msg), 'message', msg);
      end;
    end loop;
    if p_dry_run or jsonb_array_length(errs) > 0 then
      raise exception '%', jsonb_build_object('kind', p_kind, 'dry_run', p_dry_run, 'rows', i, 'valid', ok, 'errors', errs, 'imported', 0)::text using errcode = 'WMS99';
    end if;
  exception when sqlstate 'WMS99' then
    return sqlerrm::jsonb;
  end;
  return jsonb_build_object('kind', p_kind, 'dry_run', false, 'rows', i, 'valid', ok, 'errors', '[]'::jsonb, 'imported', ok);
end $$;

-- ---------- backups: nightly export of key tables to a private bucket by the backup-export Edge Function ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('backups', 'backups', false, 52428800) on conflict (id) do nothing;
create or replace function public.dispatch_backup() returns boolean language plpgsql security definer set search_path = '' as $$
declare v_url text := (select value from public.internal_secrets where key = 'functions_url'); v_sec text := (select value from public.internal_secrets where key = 'cron_secret');
begin
  if v_url is null or v_sec is null then raise exception 'functions_url and cron_secret are not set (see docs/backups.md)'; end if;
  perform net.http_post(url := v_url || '/backup-export', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_sec), body := '{}'::jsonb);
  return true;
end $$;

-- ---------- RLS and grants ----------
alter table public.cron_job_state enable row level security;
alter table public.cron_job_runs enable row level security;
alter table public.rate_limits enable row level security;
create policy cron_state_select on public.cron_job_state for select to authenticated using (public.is_admin());
create policy cron_runs_select on public.cron_job_runs for select to authenticated using (public.is_admin());
revoke all on public.cron_job_state, public.cron_job_runs, public.rate_limits from anon, authenticated;
grant select on public.cron_job_state, public.cron_job_runs to authenticated;
revoke execute on all functions in schema public from anon, public;
revoke execute on function public.cron_run(text, text, boolean, integer), public.rate_limit_hit(text, integer, integer), public.cleanup_old_data(), public.dispatch_backup() from authenticated;

-- ---------- schedule through cron_run so every run is logged and failures raise an admin warning ----------
select cron.schedule('wms-evaluate-alerts', '* * * * *', $cron$select public.cron_run('wms-evaluate-alerts', 'select public.evaluate_alerts()', false, 10)$cron$);
select cron.schedule('wms-notify-dispatch', '* * * * *', $cron$select public.cron_run('wms-notify-dispatch', 'select public.dispatch_notifications()', false, 10)$cron$);
select cron.schedule('wms-readings-rollup', '30 20 * * *', $cron$select public.cron_run('wms-readings-rollup', 'select public.rollup_readings()')$cron$);
select cron.schedule('wms-maintenance-reminders', '30 2 * * *', $cron$select public.cron_run('wms-maintenance-reminders', 'select public.maintenance_reminders()')$cron$);
select cron.schedule('wms-occupancy-snapshot', '35 18 * * *', $cron$select public.cron_run('wms-occupancy-snapshot', 'select public.snapshot_occupancy_backfill()')$cron$);
select cron.schedule('wms-mark-overdue', '0 19 * * *', $cron$select public.cron_run('wms-mark-overdue', 'select public.mark_overdue_invoices()')$cron$);
select cron.schedule('wms-generate-invoices', '10 19 * * *', $cron$select public.cron_run('wms-generate-invoices', 'select public.generate_scheduled_drafts()')$cron$);
select cron.schedule('wms-backup-export', '30 21 * * *', $cron$select public.cron_run('wms-backup-export', 'select public.dispatch_backup()')$cron$);
select cron.schedule('wms-cleanup', '0 22 * * *', $cron$select public.cron_run('wms-cleanup', 'select public.cleanup_old_data()')$cron$);
