-- Staff can raise dispatch requests, and add a client on the spot when a lorry arrives.

-- 1) staff see clients when contracts are optional (otherwise the client list at the gate is empty for them)
create or replace function public.can_see_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.is_accountant()
      or public.current_app_role() = 'WAREHOUSE_MANAGER'
      or public.is_my_client(p_client_id)
      or (public.current_app_role() = 'STAFF' and not coalesce((select (value ->> 'required')::boolean from public.app_settings where key = 'contracts'), false))
      or exists (select 1 from public.contracts c
                 where c.client_id = p_client_id and c.deleted_at is null and public.can_read_warehouse(c.warehouse_id))
$$;

-- 2) dispatch requests: anyone who works in the warehouse may raise one (managers still approve)
alter policy dispatch_requests_insert on public.dispatch_requests
  with check (public.can_operate_warehouse(warehouse_id) or (public.is_my_client(client_id) and public.client_sees_warehouse(warehouse_id)));
alter policy dispatch_request_lines_insert on public.dispatch_request_lines
  with check (public.can_operate_warehouse(warehouse_id) or public.is_my_client(client_id));

do $$
declare r record; def text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc like '%Not allowed to raise dispatch requests%' and p.prosrc like '%can_write_warehouse(new.warehouse_id)%' loop
    def := replace(pg_get_functiondef(r.oid), 'can_write_warehouse(new.warehouse_id)', 'can_operate_warehouse(new.warehouse_id)');
    execute def;
  end loop;
end $$;

-- 3) add a client in one step at the gate
create or replace function public.quick_create_client(p_name text, p_phone text default null, p_gstin text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; g text := nullif(upper(trim(p_gstin)), '');
begin
  if public.current_app_role() not in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF') then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'Enter the company name' using errcode = 'WMS08'; end if;
  if g is not null and not public.is_valid_gstin(g) then raise exception 'GSTIN is not valid' using errcode = 'WMS08'; end if;
  select id into v_id from public.clients where lower(company_name) = lower(trim(p_name)) and deleted_at is null limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.clients (company_name, phone, gstin, state_code) values (trim(p_name), nullif(trim(p_phone), ''), g, substr(g, 1, 2)) returning id into v_id;
  return v_id;
end $$;
revoke execute on all functions in schema public from anon, public;
