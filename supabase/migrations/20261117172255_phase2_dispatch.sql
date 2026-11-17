-- =====================================================================
-- Phase 2: dispatch requests, picking (FEFO/FIFO + scan checks), delivery
-- challans, stock transfer / adjustment, document cancellation.
-- More error codes:  WMS11 wrong batch scanned  WMS12 ambiguous slot scan
--                    WMS13 picking incomplete
-- =====================================================================

create table public.dispatch_requests (
  id              uuid primary key default gen_random_uuid(),
  request_no      text unique,
  client_id       uuid not null references public.clients(id),
  warehouse_id    uuid not null references public.warehouses(id),
  to_company_id   uuid not null references public.company_master(id),
  requested_date  date not null,
  status          public.dispatch_status not null default 'REQUESTED',
  remarks         text,
  requested_by    uuid default auth.uid(),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index dispatch_requests_client_idx    on public.dispatch_requests (client_id);
create index dispatch_requests_warehouse_idx on public.dispatch_requests (warehouse_id);
create index dispatch_requests_status_idx    on public.dispatch_requests (status);

create table public.dispatch_request_lines (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.dispatch_requests(id),
  warehouse_id  uuid not null references public.warehouses(id),
  client_id     uuid not null references public.clients(id),
  line_no       integer not null,
  item_name     text not null check (length(trim(item_name)) > 0),
  sku           text,
  batch_no      text,     -- optional: ask for one specific batch
  unit          text not null default 'BOX',
  quantity      numeric(14,3) not null check (quantity > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint dispatch_line_no_uq unique (request_id, line_no)
);
create index dispatch_request_lines_request_idx on public.dispatch_request_lines (request_id);
create index dispatch_request_lines_client_idx  on public.dispatch_request_lines (client_id);

create table public.dispatch_picks (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.dispatch_requests(id),
  request_line_id  uuid not null references public.dispatch_request_lines(id),
  warehouse_id     uuid not null references public.warehouses(id),
  client_id        uuid not null references public.clients(id),
  pick_seq         integer not null,
  stock_item_id    uuid not null references public.stock_items(id),
  slot_id          uuid not null references public.brigade_slots(id),
  slot_code        text not null,
  item_name        text not null,
  sku              text,
  batch_no         text,
  expiry_date      date,
  quantity         numeric(14,3) not null check (quantity > 0),
  picked           boolean not null default false,
  picked_by        uuid,
  picked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index dispatch_picks_request_idx on public.dispatch_picks (request_id);
create index dispatch_picks_item_idx    on public.dispatch_picks (stock_item_id);

create table public.delivery_challans (
  id                   uuid primary key default gen_random_uuid(),
  challan_no           text not null unique,
  warehouse_id         uuid not null references public.warehouses(id),
  client_id            uuid not null references public.clients(id),
  dispatch_request_id  uuid not null unique references public.dispatch_requests(id),
  gate_entry_id        uuid not null unique references public.gate_entries(id),
  to_company_id        uuid not null references public.company_master(id),
  dispatched_at        timestamptz not null default now(),
  dispatch_temp_c      numeric(5,2),
  seal_number          text,
  receiver_name        text,
  signature_path       text,          -- bucket "signatures": proof of delivery
  pod_signed_at        timestamptz,
  status               public.document_status not null default 'CONFIRMED',
  remarks              text,
  confirmed_by         uuid default auth.uid(),
  cancel_reason        text,
  cancelled_by         uuid,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index delivery_challans_warehouse_idx on public.delivery_challans (warehouse_id);
create index delivery_challans_client_idx    on public.delivery_challans (client_id);
create index delivery_challans_status_idx    on public.delivery_challans (status);

create table public.delivery_challan_lines (
  id             uuid primary key default gen_random_uuid(),
  challan_id     uuid not null references public.delivery_challans(id),
  warehouse_id   uuid not null references public.warehouses(id),
  client_id      uuid not null references public.clients(id),
  pick_id        uuid references public.dispatch_picks(id),
  stock_item_id  uuid not null references public.stock_items(id),
  slot_id        uuid not null references public.brigade_slots(id),
  slot_code      text not null,
  line_no        integer not null,
  item_name      text not null,
  sku            text,
  batch_no       text,
  mfg_date       date,
  expiry_date    date,
  unit           text not null,
  quantity       numeric(14,3) not null check (quantity > 0),
  packages       integer not null default 0,
  weight_kg      numeric(12,3) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index delivery_challan_lines_challan_idx on public.delivery_challan_lines (challan_id);
create index delivery_challan_lines_client_idx  on public.delivery_challan_lines (client_id);

alter table public.gate_entries add constraint gate_entries_dispatch_request_fk
  foreign key (dispatch_request_id) references public.dispatch_requests(id);

do $$
declare t text;
begin
  foreach t in array array['dispatch_requests','dispatch_request_lines','dispatch_picks',
                           'delivery_challans','delivery_challan_lines']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- request guards ----------
create or replace function public.dispatch_requests_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.status := 'REQUESTED';
  new.request_no := null;
  new.decided_by := null; new.decided_at := null; new.decision_note := null;
  new.requested_by := auth.uid();
  if not (public.is_my_client(new.client_id) or public.can_write_warehouse(new.warehouse_id)) then
    raise exception 'Not allowed to raise dispatch requests for this client' using errcode = '42501';
  end if;
  if not public.client_has_active_contract(new.client_id, new.warehouse_id, public.today_ist()) then
    raise exception 'Client has no active contract with this warehouse' using errcode = 'WMS14';
  end if;
  if not public.company_belongs_to_client(new.to_company_id, new.client_id) then
    raise exception 'Company does not belong to this client' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger a_dispatch_requests_guard before insert on public.dispatch_requests
  for each row execute function public.dispatch_requests_guard();
create trigger b_dispatch_requests_number before insert on public.dispatch_requests
  for each row execute function public.assign_doc_number('DR', 'request_no');

create or replace function public.dispatch_request_lines_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare r public.dispatch_requests;
begin
  select * into r from public.dispatch_requests where id = new.request_id;
  if not found then
    raise exception 'Dispatch request not found' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' and r.status <> 'REQUESTED' then
    raise exception 'Lines can only be added while the request is REQUESTED' using errcode = 'WMS03';
  end if;
  new.warehouse_id := r.warehouse_id;
  new.client_id := r.client_id;
  if new.line_no is null then
    select coalesce(max(line_no), 0) + 1 into new.line_no from public.dispatch_request_lines where request_id = new.request_id;
  end if;
  return new;
end;
$$;

create trigger a_dispatch_request_lines_sync before insert or update on public.dispatch_request_lines
  for each row execute function public.dispatch_request_lines_sync();

-- RLS
alter table public.dispatch_requests      enable row level security;
alter table public.dispatch_request_lines enable row level security;
alter table public.dispatch_picks         enable row level security;
alter table public.delivery_challans      enable row level security;
alter table public.delivery_challan_lines enable row level security;

create policy dispatch_requests_select on public.dispatch_requests for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy dispatch_requests_insert on public.dispatch_requests for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id)
              or (public.is_my_client(client_id) and public.client_sees_warehouse(warehouse_id)));
create policy dispatch_request_lines_select on public.dispatch_request_lines for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy dispatch_request_lines_insert on public.dispatch_request_lines for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id) or public.is_my_client(client_id));
create policy dispatch_picks_select on public.dispatch_picks for select to authenticated
  using (public.can_read_warehouse(warehouse_id));
create policy delivery_challans_select on public.delivery_challans for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy delivery_challan_lines_select on public.delivery_challan_lines for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));

revoke update, delete on public.dispatch_requests, public.dispatch_request_lines from authenticated;
revoke insert, update, delete on public.dispatch_picks, public.delivery_challans, public.delivery_challan_lines
  from authenticated;

-- clients may read the signature on their own challans
create policy wms_signatures_select on storage.objects for select to authenticated
  using (bucket_id = 'signatures'
         and (public.can_read_warehouse(public.path_warehouse_id(name))
              or exists (select 1 from public.delivery_challans d
                         where d.signature_path = name and public.is_my_client(d.client_id))));

-- ---------- helpers ----------
create or replace function public.stock_reserved_qty(p_stock_item_id uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(p.quantity), 0)
  from public.dispatch_picks p join public.dispatch_requests r on r.id = p.request_id
  where p.stock_item_id = p_stock_item_id and r.status in ('APPROVED', 'PICKING')
$$;

-- available = on hand - already promised to approved requests
create or replace function public.stock_available_qty(p_stock_item_id uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select greatest(i.quantity - public.stock_reserved_qty(i.id), 0)
  from public.stock_items i where i.id = p_stock_item_id
$$;

-- ---------- approve / reject / cancel requests ----------
create or replace function public.approve_dispatch_request(p_request_id uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       public.dispatch_requests;
  ln      public.dispatch_request_lines;
  it      record;
  v_rule  public.pick_rule;
  v_need  numeric;
  v_take  numeric;
  v_seq   integer := 0;
  v_have  numeric;
begin
  select * into r from public.dispatch_requests where id = p_request_id and deleted_at is null for update;
  if not found then
    raise exception 'Dispatch request not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(r.warehouse_id) then
    raise exception 'Only a manager of this warehouse can approve dispatches' using errcode = '42501';
  end if;
  if r.status <> 'REQUESTED' then
    raise exception 'Dispatch request is already %', r.status using errcode = 'WMS03';
  end if;
  if not exists (select 1 from public.dispatch_request_lines where request_id = r.id and deleted_at is null) then
    raise exception 'The request has no lines' using errcode = 'WMS06';
  end if;
  select pick_rule into v_rule from public.clients where id = r.client_id;

  for ln in select * from public.dispatch_request_lines
            where request_id = r.id and deleted_at is null order by line_no loop
    v_need := ln.quantity;
    for it in
      select i.*, public.stock_available_qty(i.id) as avail
      from public.stock_items i
      where i.client_id = r.client_id and i.warehouse_id = r.warehouse_id and i.deleted_at is null
        and i.quantity > 0 and i.condition = 'GOOD'
        and (case when ln.sku is not null then i.sku = ln.sku else i.item_name = ln.item_name end)
        and (ln.batch_no is null or i.batch_no = ln.batch_no)
      order by
        case when v_rule = 'FEFO' then i.expiry_date end asc nulls last,
        i.received_at asc,
        i.quantity asc,      -- ties: empty the smaller (partial) slot first so slots free up sooner
        i.slot_code, i.id
      for update of i
    loop
      exit when v_need <= 0;
      continue when it.avail <= 0;
      v_take := least(v_need, it.avail);
      v_seq := v_seq + 1;
      insert into public.dispatch_picks (request_id, request_line_id, warehouse_id, client_id, pick_seq,
        stock_item_id, slot_id, slot_code, item_name, sku, batch_no, expiry_date, quantity)
      values (r.id, ln.id, r.warehouse_id, r.client_id, v_seq, it.id, it.slot_id, it.slot_code, it.item_name,
              it.sku, it.batch_no, it.expiry_date, v_take);
      v_need := v_need - v_take;
    end loop;
    if v_need > 0 then
      v_have := ln.quantity - v_need;
      raise exception 'Insufficient stock for %: requested %, available %',
        coalesce(ln.sku, ln.item_name), ln.quantity, v_have using errcode = 'WMS04';
    end if;
  end loop;

  update public.dispatch_requests
     set status = 'APPROVED', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = r.id;
  return v_seq;
end;
$$;

create or replace function public.reject_dispatch_request(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.dispatch_requests;
begin
  select * into r from public.dispatch_requests where id = p_request_id and deleted_at is null for update;
  if not found then
    raise exception 'Dispatch request not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(r.warehouse_id) then
    raise exception 'Only a manager can reject dispatches' using errcode = '42501';
  end if;
  if r.status <> 'REQUESTED' then
    raise exception 'Dispatch request is already %', r.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required' using errcode = 'WMS08';
  end if;
  update public.dispatch_requests
     set status = 'REJECTED', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = r.id;
end;
$$;

create or replace function public.cancel_dispatch_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.dispatch_requests;
begin
  select * into r from public.dispatch_requests where id = p_request_id and deleted_at is null for update;
  if not found then
    raise exception 'Dispatch request not found' using errcode = 'P0002';
  end if;
  if not (public.can_write_warehouse(r.warehouse_id) or (public.is_my_client(r.client_id) and r.status = 'REQUESTED')) then
    raise exception 'Not allowed to cancel this request' using errcode = '42501';
  end if;
  if r.status not in ('REQUESTED', 'APPROVED', 'PICKING') then
    raise exception 'Dispatch request is already %', r.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = 'WMS08';
  end if;
  -- picks stop reserving stock as soon as the request is no longer APPROVED/PICKING
  update public.dispatch_requests
     set status = 'CANCELLED', decided_by = auth.uid(), decided_at = now(), decision_note = p_reason
   where id = r.id;
end;
$$;

-- ---------- picking by scan ----------
-- Accepted codes:  WMS:STOCK:<stock item id>   (pallet / batch label)
--                  WMS:SLOT:<slot id>          (only if the slot holds just this batch)
--                  the batch number itself      (e.g. a manufacturer barcode)
create or replace function public.record_pick_scan(p_pick_id uuid, p_code text)
returns public.dispatch_picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk      public.dispatch_picks;
  r       public.dispatch_requests;
  v_code  text := trim(coalesce(p_code, ''));
  v_id    uuid;
  other   public.stock_items;
begin
  select * into pk from public.dispatch_picks where id = p_pick_id for update;
  if not found then
    raise exception 'Pick not found' using errcode = 'P0002';
  end if;
  select * into r from public.dispatch_requests where id = pk.request_id for update;
  if not public.can_operate_warehouse(r.warehouse_id) then
    raise exception 'Not allowed to pick in this warehouse' using errcode = '42501';
  end if;
  if r.status not in ('APPROVED', 'PICKING') then
    raise exception 'Dispatch request is %', r.status using errcode = 'WMS03';
  end if;

  if upper(v_code) like 'WMS:STOCK:%' then
    v_id := nullif(substr(v_code, 11), '')::uuid;
    if v_id <> pk.stock_item_id then
      select * into other from public.stock_items where id = v_id;
      raise exception 'Wrong batch: scanned % (%), pick % from slot %',
        coalesce(other.batch_no, '-'), coalesce(other.slot_code, '?'), coalesce(pk.batch_no, '-'), pk.slot_code
        using errcode = 'WMS11';
    end if;
  elsif upper(v_code) like 'WMS:SLOT:%' then
    v_id := nullif(substr(v_code, 10), '')::uuid;
    if v_id <> pk.slot_id then
      raise exception 'Wrong slot: pick from %', pk.slot_code using errcode = 'WMS11';
    end if;
    if exists (select 1 from public.stock_items i
               where i.slot_id = pk.slot_id and i.quantity > 0 and i.deleted_at is null
                 and i.id <> pk.stock_item_id and i.batch_no is distinct from pk.batch_no) then
      raise exception 'Slot % holds several batches; scan the batch label', pk.slot_code using errcode = 'WMS12';
    end if;
  elsif pk.batch_no is not null and upper(v_code) = upper(pk.batch_no) then
    null;  -- batch number matches
  else
    raise exception 'Wrong batch: scanned %, pick % from slot %', v_code, coalesce(pk.batch_no, '-'), pk.slot_code
      using errcode = 'WMS11';
  end if;

  update public.dispatch_picks set picked = true, picked_by = auth.uid(), picked_at = now()
   where id = pk.id returning * into pk;
  if r.status = 'APPROVED' then
    update public.dispatch_requests set status = 'PICKING' where id = r.id;
  end if;
  return pk;
end;
$$;

-- ---------- confirm_delivery_challan ----------
-- One transaction: challan + lines, stock deduction, OUT movements, emptied slots
-- released (allocation end_date), dispatch temperature + seal, gate entry linked.
create or replace function public.confirm_delivery_challan(
  p_request_id      uuid,
  p_gate_entry_id   uuid,
  p_dispatch_temp_c numeric default null,
  p_seal_number     text default null,
  p_receiver_name   text default null,
  p_signature_path  text default null,
  p_labour          jsonb default '[]'::jsonb,
  p_remarks         text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.dispatch_requests;
  g          public.gate_entries;
  pk         public.dispatch_picks;
  it         public.stock_items;
  x          jsonb;
  v_challan  uuid;
  v_no       text;
  v_line     integer := 0;
  v_w        numeric;
  v_pk       integer;
  v_today    date := public.today_ist();
begin
  select * into r from public.dispatch_requests where id = p_request_id and deleted_at is null for update;
  if not found then
    raise exception 'Dispatch request not found' using errcode = 'P0002';
  end if;
  if not public.can_operate_warehouse(r.warehouse_id) then
    raise exception 'Not allowed to dispatch from this warehouse' using errcode = '42501';
  end if;
  if r.status not in ('APPROVED', 'PICKING') then
    raise exception 'Dispatch request is %', r.status using errcode = 'WMS03';
  end if;
  if not exists (select 1 from public.dispatch_picks where request_id = r.id) then
    raise exception 'Nothing to dispatch' using errcode = 'WMS13';
  end if;
  if exists (select 1 from public.dispatch_picks where request_id = r.id and not picked) then
    raise exception 'Scan every pick before confirming the challan' using errcode = 'WMS13';
  end if;

  select * into g from public.gate_entries where id = p_gate_entry_id and deleted_at is null for update;
  if not found then
    raise exception 'Gate entry not found' using errcode = 'P0002';
  end if;
  if g.direction <> 'OUTWARD' or g.warehouse_id <> r.warehouse_id or g.client_id <> r.client_id
     or g.status not in ('AT_GATE', 'LOADING') then
    raise exception 'Gate entry % is not an open outward lorry for this client', g.gate_pass_no using errcode = 'WMS03';
  end if;

  v_no := public.next_doc_number(r.warehouse_id, 'DC');
  insert into public.delivery_challans (challan_no, warehouse_id, client_id, dispatch_request_id, gate_entry_id,
    to_company_id, dispatch_temp_c, seal_number, receiver_name, signature_path, pod_signed_at, remarks)
  values (v_no, r.warehouse_id, r.client_id, r.id, g.id, r.to_company_id, p_dispatch_temp_c,
          nullif(p_seal_number, ''), nullif(p_receiver_name, ''), nullif(p_signature_path, ''),
          case when nullif(p_signature_path, '') is not null then now() end, p_remarks)
  returning id into v_challan;

  for pk in select * from public.dispatch_picks where request_id = r.id order by pick_seq loop
    select * into it from public.stock_items where id = pk.stock_item_id for update;
    if it.quantity < pk.quantity then
      raise exception 'Insufficient stock in % for batch %: need %, have %',
        it.slot_code, coalesce(it.batch_no, '-'), pk.quantity, it.quantity using errcode = 'WMS04';
    end if;
    v_w := case when it.quantity = pk.quantity then it.weight_kg else round(pk.quantity * it.unit_weight_kg, 3) end;
    v_pk := case when it.quantity = pk.quantity then it.packages
                 else least(it.packages, round(it.packages * pk.quantity / it.quantity)::integer) end;

    update public.stock_items
       set quantity = quantity - pk.quantity,
           weight_kg = greatest(weight_kg - v_w, 0),
           packages = greatest(packages - v_pk, 0)
     where id = it.id;

    insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, from_slot_id,
                                        qty_delta, weight_delta, document_type, document_id, reason)
    values ('OUT', it.id, r.client_id, r.warehouse_id, it.slot_id, -pk.quantity, -v_w,
            'DELIVERY_CHALLAN', v_challan, 'Dispatch ' || v_no);

    v_line := v_line + 1;
    insert into public.delivery_challan_lines (challan_id, warehouse_id, client_id, pick_id, stock_item_id, slot_id,
      slot_code, line_no, item_name, sku, batch_no, mfg_date, expiry_date, unit, quantity, packages, weight_kg)
    values (v_challan, r.warehouse_id, r.client_id, pk.id, it.id, it.slot_id, it.slot_code, v_line, it.item_name,
            it.sku, it.batch_no, it.mfg_date, it.expiry_date, it.unit, pk.quantity, v_pk, v_w);

    perform public.release_slot_if_empty(it.slot_id, v_today, 'DELIVERY_CHALLAN', v_challan);
  end loop;

  for x in select e from jsonb_array_elements(coalesce(p_labour, '[]'::jsonb)) e loop
    insert into public.labour_entries (warehouse_id, client_id, document_type, document_id, activity,
                                       packages, tonnes, workers, hours, remarks)
    values (r.warehouse_id, r.client_id, 'DELIVERY_CHALLAN', v_challan, (x ->> 'activity')::public.labour_activity,
            coalesce((x ->> 'packages')::integer, 0), coalesce((x ->> 'tonnes')::numeric, 0),
            (x ->> 'workers')::integer, coalesce((x ->> 'hours')::numeric, 0), nullif(x ->> 'remarks', ''));
  end loop;

  update public.gate_entries
     set status = 'DISPATCHED', dispatch_request_id = r.id,
         seal_number_departure = coalesce(nullif(p_seal_number, ''), seal_number_departure),
         loading_start_at = coalesce(loading_start_at, gate_in_at),
         loading_end_at = coalesce(loading_end_at, now())
   where id = g.id;
  update public.dispatch_requests set status = 'DISPATCHED' where id = r.id;
  return v_challan;
end;
$$;

-- proof of delivery added after dispatch (receiver signs at destination)
create or replace function public.record_challan_pod(p_challan_id uuid, p_receiver_name text, p_signature_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d public.delivery_challans;
begin
  select * into d from public.delivery_challans where id = p_challan_id for update;
  if not found then
    raise exception 'Challan not found' using errcode = 'P0002';
  end if;
  if not public.can_operate_warehouse(d.warehouse_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if d.status <> 'CONFIRMED' then
    raise exception 'Challan is %', d.status using errcode = 'WMS03';
  end if;
  update public.delivery_challans
     set receiver_name = coalesce(nullif(p_receiver_name, ''), receiver_name),
         signature_path = p_signature_path, pod_signed_at = now()
   where id = d.id;
end;
$$;

-- ---------- transfer between slots ----------
create or replace function public.transfer_stock(p_stock_item_id uuid, p_to_slot_id uuid, p_quantity numeric, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  it      public.stock_items;
  s       public.brigade_slots;
  v_new   uuid;
  v_w     numeric;
  v_pk    integer;
  v_today date := public.today_ist();
begin
  select * into it from public.stock_items where id = p_stock_item_id and deleted_at is null for update;
  if not found then
    raise exception 'Stock item not found' using errcode = 'P0002';
  end if;
  if not public.can_operate_warehouse(it.warehouse_id) then
    raise exception 'Not allowed to move stock in this warehouse' using errcode = '42501';
  end if;
  if p_to_slot_id = it.slot_id then
    raise exception 'Choose a different slot' using errcode = 'WMS07';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > public.stock_available_qty(it.id) then
    raise exception 'Can move at most % (the rest is reserved for dispatch)', public.stock_available_qty(it.id)
      using errcode = 'WMS04';
  end if;

  v_w := case when p_quantity = it.quantity then it.weight_kg else round(p_quantity * it.unit_weight_kg, 3) end;
  v_pk := case when p_quantity = it.quantity then it.packages else round(it.packages * p_quantity / it.quantity)::integer end;
  s := public.occupy_slot(p_to_slot_id, it.client_id, it.warehouse_id, it.storage_type, it.required_temp_c, v_w,
                          'TRANSFER', it.id, v_today);

  update public.stock_items set quantity = quantity - p_quantity, weight_kg = greatest(weight_kg - v_w, 0),
         packages = greatest(packages - v_pk, 0)
   where id = it.id;
  insert into public.stock_items (client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, sku, batch_no,
    mfg_date, expiry_date, unit, quantity, packages, unit_weight_kg, weight_kg, condition, storage_type,
    required_temp_c, inward_receipt_id, inward_line_id, received_at)
  values (it.client_id, it.warehouse_id, s.zone_id, s.id, s.code, it.item_name, it.sku, it.batch_no, it.mfg_date,
          it.expiry_date, it.unit, p_quantity, v_pk, it.unit_weight_kg, v_w, it.condition, it.storage_type,
          it.required_temp_c, it.inward_receipt_id, it.inward_line_id, it.received_at)
  returning id into v_new;

  insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, from_slot_id, to_slot_id,
                                      qty_delta, weight_delta, document_type, document_id, reason)
  values ('TRANSFER', it.id, it.client_id, it.warehouse_id, it.slot_id, s.id, -p_quantity, -v_w, 'TRANSFER', v_new, p_reason),
         ('TRANSFER', v_new, it.client_id, it.warehouse_id, it.slot_id, s.id, p_quantity, v_w, 'TRANSFER', it.id, p_reason);

  perform public.release_slot_if_empty(it.slot_id, v_today, 'TRANSFER', v_new);
  return v_new;
end;
$$;

-- ---------- adjustment (manager, reason required) ----------
create or replace function public.adjust_stock(p_stock_item_id uuid, p_new_quantity numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it      public.stock_items;
  v_delta numeric;
  v_w     numeric;
  v_cap   numeric;
begin
  select * into it from public.stock_items where id = p_stock_item_id and deleted_at is null for update;
  if not found then
    raise exception 'Stock item not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(it.warehouse_id) then
    raise exception 'Only a manager can adjust stock' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required for a stock adjustment' using errcode = 'WMS08';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'Quantity cannot be negative' using errcode = 'WMS06';
  end if;
  if p_new_quantity < public.stock_reserved_qty(it.id) then
    raise exception 'Quantity cannot go below % already reserved for dispatch', public.stock_reserved_qty(it.id)
      using errcode = 'WMS04';
  end if;
  v_delta := p_new_quantity - it.quantity;
  if v_delta = 0 then
    return;
  end if;
  v_w := round(p_new_quantity * it.unit_weight_kg, 3) - it.weight_kg;
  if v_delta > 0 then
    select bt.max_weight_kg into v_cap from public.brigade_slots s join public.brigade_types bt on bt.id = s.brigade_type_id
     where s.id = it.slot_id;
    if public.slot_load_kg(it.slot_id) + v_w > v_cap then
      raise exception 'Over capacity: slot % maximum is % kg', it.slot_code, v_cap using errcode = 'WMS02';
    end if;
  end if;
  update public.stock_items
     set quantity = p_new_quantity, weight_kg = greatest(weight_kg + v_w, 0),
         packages = case when it.quantity > 0 then round(it.packages * p_new_quantity / it.quantity)::integer else packages end
   where id = it.id;
  insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, from_slot_id,
                                      qty_delta, weight_delta, document_type, document_id, reason)
  values ('ADJUSTMENT', it.id, it.client_id, it.warehouse_id, it.slot_id, v_delta, v_w, 'ADJUSTMENT', null, p_reason);
  if p_new_quantity = 0 then
    perform public.release_slot_if_empty(it.slot_id, public.today_ist(), 'ADJUSTMENT', it.id);
  end if;
end;
$$;

-- ---------- cancellations (manager + reason; reversed by new ledger rows) ----------
create or replace function public.cancel_inward_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rc    public.inward_receipts;
  it    public.stock_items;
begin
  select * into rc from public.inward_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(rc.warehouse_id) then
    raise exception 'Only a manager can cancel a receipt' using errcode = '42501';
  end if;
  if rc.status <> 'CONFIRMED' then
    raise exception 'Receipt is already %', rc.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A cancellation reason is required' using errcode = 'WMS08';
  end if;
  if exists (select 1 from public.stock_movements m
             join public.stock_items i on i.id = m.stock_item_id
             where i.inward_receipt_id = rc.id and m.movement_type <> 'IN') then
    raise exception 'Goods from % have already been moved or dispatched; reverse those first', rc.receipt_no
      using errcode = 'WMS09';
  end if;

  for it in select * from public.stock_items where inward_receipt_id = rc.id and quantity > 0 for update loop
    update public.stock_items set quantity = 0, weight_kg = 0, packages = 0 where id = it.id;
    insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, from_slot_id,
                                        qty_delta, weight_delta, document_type, document_id, reason)
    values ('ADJUSTMENT', it.id, it.client_id, it.warehouse_id, it.slot_id, -it.quantity, -it.weight_kg,
            'INWARD_RECEIPT_CANCEL', rc.id, p_reason);
    perform public.release_slot_if_empty(it.slot_id, public.today_ist(), 'INWARD_RECEIPT_CANCEL', rc.id);
  end loop;

  update public.slot_allocations set cancelled = true
   where start_document_type = 'INWARD_RECEIPT' and start_document_id = rc.id;
  update public.labour_entries set cancelled = true where document_type = 'INWARD_RECEIPT' and document_id = rc.id;
  update public.inward_receipts
     set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now()
   where id = rc.id;
  update public.gate_entries
     set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now()
   where id = rc.gate_entry_id;
end;
$$;

create or replace function public.cancel_delivery_challan(p_challan_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d     public.delivery_challans;
  ln    public.delivery_challan_lines;
  it    public.stock_items;
  v_today date := public.today_ist();
begin
  select * into d from public.delivery_challans where id = p_challan_id for update;
  if not found then
    raise exception 'Challan not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(d.warehouse_id) then
    raise exception 'Only a manager can cancel a challan' using errcode = '42501';
  end if;
  if d.status <> 'CONFIRMED' then
    raise exception 'Challan is already %', d.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A cancellation reason is required' using errcode = 'WMS08';
  end if;

  for ln in select * from public.delivery_challan_lines where challan_id = d.id order by line_no loop
    select * into it from public.stock_items where id = ln.stock_item_id for update;
    -- an allocation closed by this challan simply re-opens (no billing gap)...
    update public.slot_allocations a
       set end_date = null, end_document_type = null, end_document_id = null
     where a.slot_id = it.slot_id and a.client_id = it.client_id
       and a.end_document_type = 'DELIVERY_CHALLAN' and a.end_document_id = d.id
       and not exists (select 1 from public.slot_allocations o
                       where o.slot_id = a.slot_id and o.end_date is null and not o.cancelled);
    -- ...then put the goods back where they came from (re-checks ownership, temperature, capacity)
    perform public.occupy_slot(it.slot_id, it.client_id, it.warehouse_id, it.storage_type, it.required_temp_c,
                               ln.weight_kg, 'DELIVERY_CHALLAN_CANCEL', d.id, v_today);

    update public.stock_items
       set quantity = quantity + ln.quantity, weight_kg = weight_kg + ln.weight_kg, packages = packages + ln.packages
     where id = it.id;
    insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, to_slot_id,
                                        qty_delta, weight_delta, document_type, document_id, reason)
    values ('ADJUSTMENT', it.id, it.client_id, it.warehouse_id, it.slot_id, ln.quantity, ln.weight_kg,
            'DELIVERY_CHALLAN_CANCEL', d.id, p_reason);
  end loop;

  update public.labour_entries set cancelled = true where document_type = 'DELIVERY_CHALLAN' and document_id = d.id;
  update public.delivery_challans
     set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now()
   where id = d.id;
  update public.dispatch_requests
     set status = 'CANCELLED', decision_note = coalesce(decision_note || ' / ', '') || 'Challan cancelled: ' || p_reason
   where id = d.dispatch_request_id;
  update public.gate_entries
     set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now()
   where id = d.gate_entry_id;
end;
$$;
