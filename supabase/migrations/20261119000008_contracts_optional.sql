-- Contracts are optional by default: an ACTIVE client can use any active warehouse straight away (gate entry, booking, dispatch).
-- Turn the setting on (app_settings 'contracts' {"required": true}) to require an active contract per client and warehouse again.
insert into public.app_settings (key, value, description) values ('contracts', '{"required": false}', 'Require an active contract before a client can use a warehouse')
on conflict (key) do nothing;

create or replace function public.client_has_active_contract(p_client_id uuid, p_warehouse_id uuid, p_on date default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when not coalesce((select (value ->> 'required')::boolean from public.app_settings where key = 'contracts'), false) then
    exists (select 1 from public.clients cl join public.warehouses w on w.id = p_warehouse_id
            where cl.id = p_client_id and cl.status = 'ACTIVE' and cl.deleted_at is null and w.is_active and w.deleted_at is null)
  else exists (
    select 1 from public.contracts c join public.clients cl on cl.id = c.client_id
    where c.client_id = p_client_id and c.warehouse_id = p_warehouse_id and c.deleted_at is null
      and c.status = 'ACTIVE' and cl.status = 'ACTIVE' and cl.deleted_at is null
      and c.start_date <= coalesce(p_on, public.today_ist()) and (c.end_date is null or c.end_date >= coalesce(p_on, public.today_ist()))) end
$$;

create or replace function public.client_sees_warehouse(p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when not coalesce((select (value ->> 'required')::boolean from public.app_settings where key = 'contracts'), false)
    then public.current_client_id() is not null and exists (select 1 from public.warehouses w where w.id = p_warehouse_id and w.is_active and w.deleted_at is null)
  else exists (select 1 from public.contracts c where c.client_id = public.current_client_id() and c.warehouse_id = p_warehouse_id and c.deleted_at is null) end
$$;
