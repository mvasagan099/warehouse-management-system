-- Inward consignment advice: a client tells the warehouse in advance what is coming. Optional; the warehouse never has to wait for one.
create sequence public.advice_no_seq;
create table public.inward_advices (
  id uuid primary key default gen_random_uuid(),
  advice_no text not null unique default ('IA' || lpad(nextval('public.advice_no_seq')::text, 5, '0')),
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  company_id uuid references public.company_master(id),
  expected_date date not null,
  lorry_number text, driver_name text, driver_phone text, remarks text,
  status text not null default 'ADVISED' check (status in ('ADVISED', 'ARRIVED', 'CANCELLED')),
  gate_entry_id uuid references public.gate_entries(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index inward_advices_wh_idx on public.inward_advices (warehouse_id, status, expected_date);
create index inward_advices_client_idx on public.inward_advices (client_id, created_at desc);
create table public.inward_advice_lines (
  id uuid primary key default gen_random_uuid(),
  advice_id uuid not null references public.inward_advices(id),
  line_no integer not null,
  item_name text not null check (length(trim(item_name)) > 0),
  sku text, batch_no text, expiry_date date,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'BOX',
  packages integer not null default 0,
  storage_type public.storage_type, required_temp_c numeric(5,2),
  unique (advice_id, line_no)
);

create or replace function public.create_inward_advice(p_warehouse_id uuid, p_expected date, p_company_id uuid, p_lorry text, p_driver_name text, p_driver_phone text,
  p_remarks text, p_lines jsonb, p_client_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; v_id uuid; l jsonb; i integer := 0;
begin
  if public.is_client() then cid := public.current_client_id();
  elsif public.can_operate_warehouse(p_warehouse_id) then cid := p_client_id;
  end if;
  if cid is null then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if not public.client_has_active_contract(cid, p_warehouse_id, p_expected) then raise exception 'This client cannot use this warehouse' using errcode = 'WMS14'; end if;
  if p_company_id is not null and not public.company_belongs_to_client(p_company_id, cid) then raise exception 'Company does not belong to this client' using errcode = '23514'; end if;
  if p_expected is null or p_expected < public.today_ist() - 1 then raise exception 'Choose today or a later date' using errcode = 'WMS08'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one item' using errcode = 'WMS08'; end if;
  insert into public.inward_advices (client_id, warehouse_id, company_id, expected_date, lorry_number, driver_name, driver_phone, remarks)
  values (cid, p_warehouse_id, p_company_id, p_expected, nullif(upper(regexp_replace(coalesce(p_lorry, ''), '[^A-Za-z0-9]', '', 'g')), ''), nullif(trim(p_driver_name), ''), nullif(trim(p_driver_phone), ''), nullif(trim(p_remarks), ''))
  returning id into v_id;
  for l in select e from jsonb_array_elements(p_lines) e loop
    i := i + 1;
    if coalesce(trim(l ->> 'item_name'), '') = '' or coalesce((l ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Line %: item and quantity are required', i using errcode = 'WMS08'; end if;
    insert into public.inward_advice_lines (advice_id, line_no, item_name, sku, batch_no, expiry_date, quantity, unit, packages, storage_type, required_temp_c)
    values (v_id, i, trim(l ->> 'item_name'), nullif(trim(l ->> 'sku'), ''), nullif(trim(l ->> 'batch_no'), ''), nullif(l ->> 'expiry_date', '')::date, (l ->> 'quantity')::numeric,
            coalesce(nullif(trim(l ->> 'unit'), ''), 'BOX'), coalesce(nullif(l ->> 'packages', '')::int, 0), nullif(l ->> 'storage_type', '')::public.storage_type, nullif(l ->> 'required_temp_c', '')::numeric);
  end loop;
  return v_id;
end $$;

create or replace function public.cancel_inward_advice(p_advice_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare a public.inward_advices;
begin
  select * into a from public.inward_advices where id = p_advice_id for update;
  if a.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  if not (public.is_my_client(a.client_id) or public.can_operate_warehouse(a.warehouse_id)) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if a.status <> 'ADVISED' then raise exception 'Only an advice that has not arrived can be cancelled' using errcode = 'WMS03'; end if;
  update public.inward_advices set status = 'CANCELLED', updated_at = now() where id = a.id;
end $$;

-- the lorry is here: the gate entry (with its goods lines) is created from the advice; staff can still correct it before receiving
create or replace function public.mark_advice_arrived(p_advice_id uuid, p_lorry text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.inward_advices; g uuid; lorry text; l public.inward_advice_lines;
begin
  select * into a from public.inward_advices where id = p_advice_id for update;
  if a.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(a.warehouse_id) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if a.status <> 'ADVISED' then raise exception 'This advice is already %', lower(a.status) using errcode = 'WMS03'; end if;
  lorry := coalesce(nullif(upper(regexp_replace(coalesce(p_lorry, ''), '[^A-Za-z0-9]', '', 'g')), ''), a.lorry_number);
  if lorry is null or lorry !~ '^[A-Z0-9]{4,12}$' then raise exception 'Enter the lorry number' using errcode = 'WMS08'; end if;
  insert into public.gate_entries (warehouse_id, direction, client_id, company_id, lorry_number, driver_name, driver_phone)
  values (a.warehouse_id, 'INWARD', a.client_id, a.company_id, lorry, a.driver_name, a.driver_phone) returning id into g;
  for l in select * from public.inward_advice_lines where advice_id = a.id order by line_no loop
    insert into public.gate_entry_lines (gate_entry_id, warehouse_id, client_id, line_no, item_name, sku, batch_no, expiry_date, packages, unit, declared_qty, storage_type, required_temp_c)
    values (g, a.warehouse_id, a.client_id, l.line_no, l.item_name, l.sku, l.batch_no, l.expiry_date, l.packages, l.unit, l.quantity, l.storage_type, l.required_temp_c);
  end loop;
  update public.inward_advices set status = 'ARRIVED', gate_entry_id = g, lorry_number = lorry, updated_at = now() where id = a.id;
  return g;
end $$;

alter table public.inward_advices enable row level security;
alter table public.inward_advice_lines enable row level security;
create policy advices_select on public.inward_advices for select to authenticated
  using ((select public.is_admin()) or warehouse_id = any (((select public.readable_warehouse_ids())::uuid[])) or client_id = (select public.current_client_id()));
create policy advice_lines_select on public.inward_advice_lines for select to authenticated using (exists (select 1 from public.inward_advices a where a.id = advice_id));
revoke all on public.inward_advices, public.inward_advice_lines from anon;
revoke insert, update, delete on public.inward_advices, public.inward_advice_lines from authenticated;
create trigger audit_row_change after insert or update or delete on public.inward_advices for each row execute function public.audit_row_change();
revoke execute on all functions in schema public from anon, public;
