-- Managers and staff see only the clients that belong to their warehouse. A client "belongs" to a warehouse when it has been linked:
-- automatically (a gate entry, booking, contract, advice or dispatch there; or it was added there), or by the administrator.
create table public.client_warehouses (
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  created_at timestamptz not null default now(),
  primary key (client_id, warehouse_id)
);
create index client_warehouses_wh_idx on public.client_warehouses (warehouse_id);

-- link what already exists
insert into public.client_warehouses (client_id, warehouse_id)
select distinct client_id, warehouse_id from (
  select client_id, warehouse_id from public.contracts where deleted_at is null
  union select client_id, warehouse_id from public.gate_entries
  union select client_id, warehouse_id from public.space_bookings
  union select client_id, warehouse_id from public.stock_items
  union select client_id, warehouse_id from public.inward_receipts
  union select client_id, warehouse_id from public.dispatch_requests
  union select client_id, warehouse_id from public.slot_allocations
  union select client_id, warehouse_id from public.inward_advices) x
on conflict do nothing;
-- a business with a single warehouse: every client belongs to it
insert into public.client_warehouses (client_id, warehouse_id)
select c.id, w.id from public.clients c cross join (select id from public.warehouses where is_active and deleted_at is null) w
where (select count(*) from public.warehouses where is_active and deleted_at is null) = 1 and c.deleted_at is null
on conflict do nothing;

create or replace function public.link_client_warehouse() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and new.warehouse_id is not null then
    insert into public.client_warehouses (client_id, warehouse_id) values (new.client_id, new.warehouse_id) on conflict do nothing;
  end if;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['contracts', 'gate_entries', 'space_bookings', 'dispatch_requests', 'inward_advices'] loop
    execute format('create trigger link_client_warehouse after insert on public.%I for each row execute function public.link_client_warehouse()', t);
  end loop;
end $$;

-- a new client is linked to the warehouse of the manager/staff who added it (or to the only warehouse, if there is just one)
create or replace function public.link_new_client() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() in ('WAREHOUSE_MANAGER', 'STAFF') then
    insert into public.client_warehouses (client_id, warehouse_id) select new.id, w from unnest(public.readable_warehouse_ids()) w on conflict do nothing;
  end if;
  insert into public.client_warehouses (client_id, warehouse_id)
  select new.id, w.id from public.warehouses w
  where w.is_active and w.deleted_at is null and (select count(*) from public.warehouses where is_active and deleted_at is null) = 1
  on conflict do nothing;
  return null;
end $$;
create trigger link_new_client after insert on public.clients for each row execute function public.link_new_client();

create or replace function public.set_client_warehouses(p_client_id uuid, p_warehouse_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can assign warehouses to a client' using errcode = 'WMS03'; end if;
  delete from public.client_warehouses where client_id = p_client_id and not (warehouse_id = any (coalesce(p_warehouse_ids, '{}')));
  insert into public.client_warehouses (client_id, warehouse_id) select p_client_id, w from unnest(coalesce(p_warehouse_ids, '{}')) w on conflict do nothing;
end $$;

-- who may see a client
create or replace function public.can_see_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.is_accountant()
      or public.is_my_client(p_client_id)
      or (public.current_app_role() in ('WAREHOUSE_MANAGER', 'STAFF')
          and exists (select 1 from public.client_warehouses cw where cw.client_id = p_client_id and cw.warehouse_id = any (public.readable_warehouse_ids())))
$$;

alter table public.client_warehouses enable row level security;
create policy client_warehouses_select on public.client_warehouses for select to authenticated
  using ((select public.is_admin()) or warehouse_id = any (((select public.readable_warehouse_ids())::uuid[])));
revoke all on public.client_warehouses from anon;
revoke insert, update, delete on public.client_warehouses from authenticated;
revoke execute on all functions in schema public from anon, public;
