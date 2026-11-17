-- =====================================================================
-- Phase 3: billing hooks on Phase 2 tables, daily occupancy snapshot and its cron job.
-- =====================================================================
create extension if not exists pg_cron;

alter table public.labour_entries add column is_night boolean not null default false, add column is_overtime boolean not null default false;
alter table public.inward_receipts   add column billed_invoice_id uuid;   -- FK added with the invoices table
alter table public.delivery_challans add column billed_invoice_id uuid;
alter table public.slot_allocations  add column min_days_invoice_id uuid;
create index inward_receipts_billed_idx   on public.inward_receipts (billed_invoice_id);
create index delivery_challans_billed_idx on public.delivery_challans (billed_invoice_id);

-- ---------- day counting rule (a setting) ----------
create or replace function public.alloc_counts_on(p_start date, p_end date, p_day date)
returns boolean language sql stable security definer set search_path = ''
as $$
  with r as (select coalesce(public.setting_json('day_count_rule'), '{"include_start":true,"include_end":false,"part_day_counts":true}'::jsonb) j)
  select (case when (j ->> 'include_start')::boolean then p_start <= p_day else p_start < p_day end)
     and (p_end is null or p_end > p_day
          or (p_end = p_day and (j ->> 'include_end')::boolean)
          or (p_end = p_start and p_day = p_start and (j ->> 'part_day_counts')::boolean))
  from r
$$;

create or replace function public.alloc_days(p_start date, p_end date)
returns integer language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from generate_series(p_start, coalesce(p_end, public.today_ist()), interval '1 day') g(d)
  where public.alloc_counts_on(p_start, p_end, g.d::date)
$$;

create or replace function public.free_days_for(p_client_id uuid, p_warehouse_id uuid, p_date date)
returns integer language sql stable security definer set search_path = ''
as $$ select coalesce((select t.free_days from public.resolve_rate_terms(p_client_id, p_warehouse_id, p_date) t), 0) $$;

-- ---------- daily occupancy ----------
create table public.daily_occupancy (
  id uuid primary key default gen_random_uuid(),
  occ_date date not null,
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  storage_type public.storage_type not null,
  temp_min numeric(5,2), temp_max numeric(5,2),
  brigade_type_id uuid not null references public.brigade_types(id),
  brigades integer not null check (brigades > 0),          -- Brigades held that day
  free_brigades integer not null default 0 check (free_brigades >= 0),   -- of which inside the free-days window
  volume_m3 numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);
create unique index daily_occupancy_uq on public.daily_occupancy
  (occ_date, client_id, warehouse_id, storage_type, brigade_type_id, coalesce(temp_min, -999), coalesce(temp_max, -999));
create index daily_occupancy_client_idx on public.daily_occupancy (client_id, warehouse_id, occ_date);

create table public.occupancy_runs (
  occ_date date primary key, run_at timestamptz not null default now(), row_count integer not null
);

create or replace function public.snapshot_occupancy(p_date date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can run the snapshot' using errcode = '42501';
  end if;
  if p_date >= public.today_ist() then
    raise exception 'Day % is not finished yet', p_date using errcode = 'WMS22';
  end if;
  -- a client's day that is already on an invoice is never recomputed (the others are)
  delete from public.daily_occupancy o where o.occ_date = p_date
     and not exists (select 1 from public.invoices i where i.client_id = o.client_id and i.warehouse_id = o.warehouse_id
                      and i.rent_range @> p_date and i.status <> 'CANCELLED');
  insert into public.daily_occupancy (occ_date, client_id, warehouse_id, storage_type, temp_min, temp_max, brigade_type_id, brigades, free_brigades, volume_m3)
  select p_date, a.client_id, a.warehouse_id, z.storage_type, z.temp_min, z.temp_max, a.brigade_type_id, count(*)::integer,
         (count(*) filter (where (p_date - a.start_date) < public.free_days_for(a.client_id, a.warehouse_id, p_date)))::integer,
         coalesce(sum(bt.volume_m3), 0)
  from public.slot_allocations a
  join public.zones z on z.id = a.zone_id
  join public.brigade_types bt on bt.id = a.brigade_type_id
  where not a.cancelled and public.alloc_counts_on(a.start_date, a.end_date, p_date)
    and not exists (select 1 from public.invoices i where i.client_id = a.client_id and i.warehouse_id = a.warehouse_id
                     and i.rent_range @> p_date and i.status <> 'CANCELLED')
  group by a.client_id, a.warehouse_id, z.storage_type, z.temp_min, z.temp_max, a.brigade_type_id;
  get diagnostics v_n = row_count;
  insert into public.occupancy_runs (occ_date, row_count) values (p_date, v_n)
  on conflict (occ_date) do update set run_at = now(), row_count = excluded.row_count;
  return v_n;
end;
$$;

-- Fills every finished day that has no snapshot yet (missed cron runs, first run, history). p_force recomputes.
create or replace function public.snapshot_occupancy_backfill(p_from date default null, p_to date default null, p_force boolean default false)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_from date; v_to date; v_n integer := 0; d date;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can run the snapshot' using errcode = '42501';
  end if;
  v_to := least(coalesce(p_to, public.today_ist() - 1), public.today_ist() - 1);
  v_from := coalesce(p_from, (select min(start_date) from public.slot_allocations where not cancelled), v_to + 1);
  for d in select g::date from generate_series(v_from, v_to, interval '1 day') g loop
    if p_force or not exists (select 1 from public.occupancy_runs r where r.occ_date = d) then
      perform public.snapshot_occupancy(d);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

alter table public.daily_occupancy enable row level security;
alter table public.occupancy_runs  enable row level security;
create policy daily_occupancy_select on public.daily_occupancy for select to authenticated using (public.can_view_billing(warehouse_id, client_id));
create policy occupancy_runs_select on public.occupancy_runs for select to authenticated using (public.is_admin() or public.is_accountant());

-- 00:05 India time = 18:35 UTC (the previous UTC day). pg_cron schedules are always UTC.
do $$ begin perform cron.unschedule('wms-occupancy-snapshot'); exception when others then null; end $$;
select cron.schedule('wms-occupancy-snapshot', '35 18 * * *', $cron$select public.snapshot_occupancy_backfill()$cron$);
