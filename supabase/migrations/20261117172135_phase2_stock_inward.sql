-- =====================================================================
-- Phase 2: inward receipts, stock, stock ledger, slot allocations, labour facts.
-- Stock is never written directly by API users: only the SECURITY DEFINER
-- functions below (and in the dispatch migration) change it.
-- Error codes:  WMS01 temperature mismatch   WMS02 over capacity
--               WMS03 wrong document state   WMS04 insufficient stock
--               WMS06 quantities don't add up WMS07 slot not usable
--               WMS08 reason required        WMS09 cannot reverse
-- =====================================================================

create table public.inward_receipts (
  id              uuid primary key default gen_random_uuid(),
  receipt_no      text not null unique,
  warehouse_id    uuid not null references public.warehouses(id),
  client_id       uuid not null references public.clients(id),
  gate_entry_id   uuid not null unique references public.gate_entries(id),
  company_id      uuid references public.company_master(id),
  received_at     timestamptz not null default now(),
  status          public.document_status not null default 'CONFIRMED',
  remarks         text,
  confirmed_by    uuid default auth.uid(),
  cancel_reason   text,
  cancelled_by    uuid,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index inward_receipts_warehouse_idx on public.inward_receipts (warehouse_id);
create index inward_receipts_client_idx    on public.inward_receipts (client_id);
create index inward_receipts_status_idx    on public.inward_receipts (status);

create table public.inward_receipt_lines (
  id                  uuid primary key default gen_random_uuid(),
  receipt_id          uuid not null references public.inward_receipts(id),
  warehouse_id        uuid not null references public.warehouses(id),
  client_id           uuid not null references public.clients(id),
  gate_entry_line_id  uuid not null references public.gate_entry_lines(id),
  line_no             integer not null,
  item_name           text not null,
  sku                 text,
  batch_no            text,
  mfg_date            date,
  expiry_date         date,
  unit                text not null,
  packages            integer not null default 0,
  declared_qty        numeric(14,3) not null,
  accepted_qty        numeric(14,3) not null default 0,
  short_qty           numeric(14,3) not null default 0,
  damaged_qty         numeric(14,3) not null default 0,
  weight_kg           numeric(12,3) not null default 0,
  storage_type        public.storage_type,
  required_temp_c     numeric(5,2),
  condition           public.line_condition not null,
  remarks             text,
  slot_codes          text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index inward_receipt_lines_receipt_idx on public.inward_receipt_lines (receipt_id);
create index inward_receipt_lines_client_idx  on public.inward_receipt_lines (client_id);

create table public.stock_items (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id),
  warehouse_id       uuid not null references public.warehouses(id),
  zone_id            uuid not null references public.zones(id),
  slot_id            uuid not null references public.brigade_slots(id),
  slot_code          text not null,                      -- denormalised: clients cannot read slots
  item_name          text not null,
  sku                text,
  batch_no           text,
  mfg_date           date,
  expiry_date        date,
  unit               text not null,
  quantity           numeric(14,3) not null check (quantity >= 0),
  packages           integer not null default 0 check (packages >= 0),
  unit_weight_kg     numeric(14,6) not null default 0 check (unit_weight_kg >= 0),
  weight_kg          numeric(12,3) not null default 0 check (weight_kg >= 0),
  condition          public.stock_condition not null default 'GOOD',
  storage_type       public.storage_type,
  required_temp_c    numeric(5,2),
  inward_receipt_id  uuid references public.inward_receipts(id),
  inward_line_id     uuid references public.inward_receipt_lines(id),
  received_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index stock_items_client_idx    on public.stock_items (client_id);
create index stock_items_warehouse_idx on public.stock_items (warehouse_id);
create index stock_items_zone_idx      on public.stock_items (zone_id);
create index stock_items_slot_idx      on public.stock_items (slot_id);
create index stock_items_expiry_idx    on public.stock_items (expiry_date);
create index stock_items_sku_idx       on public.stock_items (client_id, sku);
create index stock_items_receipt_idx   on public.stock_items (inward_receipt_id);

-- Append-only ledger. Every change to stock_items has a row here.
create table public.stock_movements (
  id             bigint generated always as identity primary key,
  movement_type  public.movement_type not null,
  stock_item_id  uuid not null references public.stock_items(id),
  client_id      uuid not null references public.clients(id),
  warehouse_id   uuid not null references public.warehouses(id),
  from_slot_id   uuid references public.brigade_slots(id),
  to_slot_id     uuid references public.brigade_slots(id),
  qty_delta      numeric(14,3) not null,
  weight_delta   numeric(12,3) not null default 0,
  document_type  text,
  document_id    uuid,
  reason         text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
create index stock_movements_item_idx      on public.stock_movements (stock_item_id);
create index stock_movements_client_idx    on public.stock_movements (client_id);
create index stock_movements_warehouse_idx on public.stock_movements (warehouse_id);
create index stock_movements_document_idx  on public.stock_movements (document_type, document_id);

create or replace function public.forbid_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public.forbid_change();

-- Which client held which slot from when to when: the basis for Phase 3 rent.
create table public.slot_allocations (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients(id),
  warehouse_id         uuid not null references public.warehouses(id),
  zone_id              uuid not null references public.zones(id),
  slot_id              uuid not null references public.brigade_slots(id),
  brigade_type_id      uuid not null references public.brigade_types(id),
  start_date           date not null,
  end_date             date,
  start_document_type  text,
  start_document_id    uuid,
  end_document_type    text,
  end_document_id      uuid,
  cancelled            boolean not null default false,   -- opened by a document that was later cancelled
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint slot_allocations_dates check (end_date is null or end_date >= start_date)
);
create unique index slot_allocations_open_uq on public.slot_allocations (slot_id) where end_date is null and not cancelled;
create index slot_allocations_client_idx    on public.slot_allocations (client_id);
create index slot_allocations_warehouse_idx on public.slot_allocations (warehouse_id);

-- Labour facts for Phase 3 billing. No money here.
create table public.labour_entries (
  id             uuid primary key default gen_random_uuid(),
  warehouse_id   uuid not null references public.warehouses(id),
  client_id      uuid not null references public.clients(id),
  document_type  text not null check (document_type in ('INWARD_RECEIPT', 'DELIVERY_CHALLAN')),
  document_id    uuid not null,
  activity       public.labour_activity not null,
  packages       integer not null default 0 check (packages >= 0),
  tonnes         numeric(10,3) not null default 0 check (tonnes >= 0),
  workers        integer not null check (workers > 0),
  hours          numeric(6,2) not null check (hours >= 0),
  remarks        text,
  cancelled      boolean not null default false,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index labour_entries_document_idx  on public.labour_entries (document_type, document_id);
create index labour_entries_warehouse_idx on public.labour_entries (warehouse_id);
create index labour_entries_client_idx    on public.labour_entries (client_id);

do $$
declare t text;
begin
  foreach t in array array['inward_receipts','inward_receipt_lines','stock_items','slot_allocations','labour_entries']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- RLS: read-only for everyone; writes only via functions ----------
alter table public.inward_receipts      enable row level security;
alter table public.inward_receipt_lines enable row level security;
alter table public.stock_items          enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.slot_allocations     enable row level security;
alter table public.labour_entries       enable row level security;

create policy inward_receipts_select on public.inward_receipts for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy inward_receipt_lines_select on public.inward_receipt_lines for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy stock_items_select on public.stock_items for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy slot_allocations_select on public.slot_allocations for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy labour_entries_select on public.labour_entries for select to authenticated
  using (public.can_read_warehouse(warehouse_id));

revoke insert, update, delete on public.inward_receipts, public.inward_receipt_lines, public.stock_items,
  public.stock_movements, public.slot_allocations, public.labour_entries from authenticated;

-- ---------- internal helpers ----------
create or replace function public.slot_load_kg(p_slot_id uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(weight_kg), 0) from public.stock_items
  where slot_id = p_slot_id and quantity > 0 and deleted_at is null
$$;

-- Put goods in a slot: checks client ownership, temperature and weight capacity,
-- marks the slot OCCUPIED and opens an allocation if the client did not hold it yet.
create or replace function public.occupy_slot(
  p_slot_id uuid, p_client_id uuid, p_warehouse_id uuid,
  p_storage_type public.storage_type, p_required_temp numeric, p_add_weight numeric,
  p_doc_type text, p_doc_id uuid, p_on date
)
returns public.brigade_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  s   public.brigade_slots;
  z   public.zones;
  cap numeric;
begin
  select * into s from public.brigade_slots where id = p_slot_id and deleted_at is null for update;
  if not found or s.warehouse_id <> p_warehouse_id then
    raise exception 'Slot is not in this warehouse' using errcode = 'WMS07';
  end if;
  if s.status = 'BLOCKED' then
    raise exception 'Slot % is blocked', s.code using errcode = 'WMS07';
  end if;
  if s.status = 'RESERVED' and s.reserved_client_id is distinct from p_client_id then
    raise exception 'Slot % is reserved for another client', s.code using errcode = 'WMS07';
  end if;
  if exists (select 1 from public.stock_items i
             where i.slot_id = s.id and i.quantity > 0 and i.deleted_at is null and i.client_id <> p_client_id) then
    raise exception 'Slot % holds another client''s goods', s.code using errcode = 'WMS07';
  end if;

  select * into z from public.zones where id = s.zone_id;
  if not public.zone_matches_temp(z.storage_type, z.temp_min, z.temp_max, p_storage_type, p_required_temp, null, null) then
    raise exception 'Temperature mismatch: goods need % %, slot % is in % zone %',
      coalesce(p_storage_type::text, ''), coalesce(p_required_temp::text || ' C', ''), s.code, z.storage_type,
      coalesce(z.temp_min::text || '..' || z.temp_max::text || ' C', '(no temperature control)')
      using errcode = 'WMS01';
  end if;

  select max_weight_kg into cap from public.brigade_types where id = s.brigade_type_id;
  if public.slot_load_kg(s.id) + coalesce(p_add_weight, 0) > cap then
    raise exception 'Over capacity: slot % would hold % kg, maximum is % kg',
      s.code, public.slot_load_kg(s.id) + coalesce(p_add_weight, 0), cap using errcode = 'WMS02';
  end if;

  if s.status <> 'OCCUPIED' then
    update public.brigade_slots set status = 'OCCUPIED' where id = s.id returning * into s;
  end if;
  if not exists (select 1 from public.slot_allocations a where a.slot_id = s.id and a.end_date is null and not a.cancelled) then
    insert into public.slot_allocations (client_id, warehouse_id, zone_id, slot_id, brigade_type_id, start_date,
                                         start_document_type, start_document_id)
    values (p_client_id, s.warehouse_id, s.zone_id, s.id, s.brigade_type_id, p_on, p_doc_type, p_doc_id);
  end if;
  return s;
end;
$$;

-- After goods leave a slot: if it is now empty, close the allocation and give the
-- slot back (RESERVED if its booking is still approved, else FREE).
create or replace function public.release_slot_if_empty(p_slot_id uuid, p_on date, p_doc_type text, p_doc_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.brigade_slots; v_keep boolean;
begin
  if exists (select 1 from public.stock_items where slot_id = p_slot_id and quantity > 0 and deleted_at is null) then
    return;
  end if;
  update public.slot_allocations
     set end_date = greatest(p_on, start_date), end_document_type = p_doc_type, end_document_id = p_doc_id
   where slot_id = p_slot_id and end_date is null and not cancelled;

  select * into s from public.brigade_slots where id = p_slot_id for update;
  if s.status <> 'OCCUPIED' then
    return;
  end if;
  v_keep := s.booking_id is not null
            and exists (select 1 from public.space_bookings b where b.id = s.booking_id and b.status = 'APPROVED');
  update public.brigade_slots
     set status = case when v_keep then 'RESERVED'::public.slot_status else 'FREE'::public.slot_status end,
         reserved_client_id = case when v_keep then reserved_client_id end,
         booking_id = case when v_keep then booking_id end
   where id = p_slot_id;
end;
$$;

-- ---------- slot suggestions ----------
-- For each line, fill matching slots: the client's RESERVED slots first, then FREE
-- ones, then slots the client already occupies, up to each brigade's weight limit.
-- p_counts (optional): [{gate_entry_line_id, accepted_qty, damaged_qty}]
create or replace function public.suggest_inward_slots(p_gate_entry_id uuid, p_counts jsonb default null)
returns table (
  gate_entry_line_id uuid, slot_id uuid, slot_code text, zone_code text,
  quantity numeric, condition public.stock_condition, reserved boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g        public.gate_entries;
  l        public.gate_entry_lines;
  c        jsonb;
  grp      record;
  cand     record;
  v_used   uuid[] := '{}';
  v_left   numeric;
  v_unit_w numeric;
  v_room   numeric;
  v_take   numeric;
begin
  select * into g from public.gate_entries where id = p_gate_entry_id and deleted_at is null;
  if not found then
    raise exception 'Gate entry not found' using errcode = 'P0002';
  end if;
  if not public.can_operate_warehouse(g.warehouse_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  for l in select * from public.gate_entry_lines
           where gate_entry_id = g.id and deleted_at is null order by line_no loop
    c := (select x from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) x
          where x ->> 'gate_entry_line_id' = l.id::text limit 1);
    v_unit_w := case when l.declared_qty > 0 then l.weight_kg / l.declared_qty else 0 end;

    for grp in
      select 'GOOD'::public.stock_condition as cond,
             coalesce((c ->> 'accepted_qty')::numeric, l.accepted_qty, l.declared_qty) as qty
      union all
      select 'DAMAGED'::public.stock_condition,
             coalesce((c ->> 'damaged_qty')::numeric, l.damaged_qty, 0)
    loop
      v_left := grp.qty;
      continue when v_left <= 0;
      for cand in
        select s.id, s.code, z.code as zcode, s.status, bt.max_weight_kg,
               public.slot_load_kg(s.id) as load_kg
        from public.brigade_slots s
        join public.zones z on z.id = s.zone_id
        join public.brigade_types bt on bt.id = s.brigade_type_id
        where s.warehouse_id = g.warehouse_id and s.deleted_at is null and z.deleted_at is null and z.is_active
          and not (s.id = any (v_used))
          and public.zone_matches_temp(z.storage_type, z.temp_min, z.temp_max, l.storage_type, l.required_temp_c, null, null)
          and (
            (s.status = 'RESERVED' and s.reserved_client_id = g.client_id)
            or s.status = 'FREE'
            or (s.status = 'OCCUPIED' and not exists (
                  select 1 from public.stock_items i
                  where i.slot_id = s.id and i.quantity > 0 and i.deleted_at is null and i.client_id <> g.client_id))
          )
        order by case when s.status = 'RESERVED' then 0 when s.status = 'FREE' then 1 else 2 end,
                 z.code, s.aisle, s.rack, s.level, s.position
      loop
        exit when v_left <= 0;
        v_room := case when v_unit_w > 0 then floor((cand.max_weight_kg - cand.load_kg) / v_unit_w * 1000) / 1000
                       else v_left end;
        continue when v_room <= 0;
        v_take := least(v_left, v_room);
        v_used := v_used || cand.id;
        gate_entry_line_id := l.id; slot_id := cand.id; slot_code := cand.code; zone_code := cand.zcode;
        quantity := v_take; condition := grp.cond; reserved := cand.status = 'RESERVED';
        return next;
        v_left := v_left - v_take;
      end loop;
    end loop;
  end loop;
end;
$$;

-- ---------- confirm_inward_receipt ----------
-- One transaction: receipt + lines, stock rows, slot occupation, IN movements,
-- allocations and labour facts. Any error rolls everything back (including the
-- document number).
--   p_lines      [{gate_entry_line_id, accepted_qty, damaged_qty, remarks}]
--   p_placements [{gate_entry_line_id, slot_id, quantity, condition: GOOD|DAMAGED}]
--   p_labour     [{activity, packages, tonnes, workers, hours, remarks}]
create or replace function public.confirm_inward_receipt(
  p_gate_entry_id uuid,
  p_lines         jsonb,
  p_placements    jsonb,
  p_labour        jsonb default '[]'::jsonb,
  p_remarks       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g          public.gate_entries;
  l          public.gate_entry_lines;
  c          jsonb;
  p          jsonb;
  x          jsonb;
  s          public.brigade_slots;
  v_receipt  uuid;
  v_no       text;
  v_line_id  uuid;
  v_item     uuid;
  v_today    date := public.today_ist();
  v_acc      numeric;
  v_dmg      numeric;
  v_short    numeric;
  v_unit_w   numeric;
  v_qty      numeric;
  v_cond     public.stock_condition;
  v_put_good numeric;
  v_put_dmg  numeric;
  v_codes    text[];
  v_used     integer := 0;
begin
  select * into g from public.gate_entries where id = p_gate_entry_id and deleted_at is null for update;
  if not found then
    raise exception 'Gate entry not found' using errcode = 'P0002';
  end if;
  if not public.can_operate_warehouse(g.warehouse_id) then
    raise exception 'Not allowed to receive goods in this warehouse' using errcode = '42501';
  end if;
  if g.direction <> 'INWARD' or g.status not in ('AT_GATE', 'UNLOADING') then
    raise exception 'Gate entry % is % and cannot be received', g.gate_pass_no, g.status using errcode = 'WMS03';
  end if;
  if not exists (select 1 from public.gate_entry_lines where gate_entry_id = g.id and deleted_at is null) then
    raise exception 'The gate entry has no load lines' using errcode = 'WMS06';
  end if;

  v_no := public.next_doc_number(g.warehouse_id, 'GRN');
  insert into public.inward_receipts (receipt_no, warehouse_id, client_id, gate_entry_id, company_id, remarks)
  values (v_no, g.warehouse_id, g.client_id, g.id, g.company_id, p_remarks)
  returning id into v_receipt;

  for l in select * from public.gate_entry_lines
           where gate_entry_id = g.id and deleted_at is null order by line_no for update loop
    c := (select e from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e
          where e ->> 'gate_entry_line_id' = l.id::text limit 1);
    if c is null then
      raise exception 'Missing the unloading count for line %', l.line_no using errcode = 'WMS06';
    end if;
    v_acc := coalesce((c ->> 'accepted_qty')::numeric, 0);
    v_dmg := coalesce((c ->> 'damaged_qty')::numeric, 0);
    if v_acc < 0 or v_dmg < 0 then
      raise exception 'Counts cannot be negative (line %)', l.line_no using errcode = 'WMS06';
    end if;
    v_short := greatest(l.declared_qty - v_acc - v_dmg, 0);
    v_unit_w := case when l.declared_qty > 0 then l.weight_kg / l.declared_qty else 0 end;

    update public.gate_entry_lines
       set counted_qty = v_acc + v_dmg, accepted_qty = v_acc, damaged_qty = v_dmg, short_qty = v_short,
           condition = case when v_dmg > 0 then 'DAMAGED'::public.line_condition
                            when v_short > 0 then 'SHORT'::public.line_condition
                            else 'GOOD'::public.line_condition end,
           remarks = coalesce(nullif(c ->> 'remarks', ''), remarks)
     where id = l.id
     returning * into l;

    insert into public.inward_receipt_lines (
      receipt_id, warehouse_id, client_id, gate_entry_line_id, line_no, item_name, sku, batch_no, mfg_date,
      expiry_date, unit, packages, declared_qty, accepted_qty, short_qty, damaged_qty, weight_kg,
      storage_type, required_temp_c, condition, remarks)
    values (
      v_receipt, g.warehouse_id, g.client_id, l.id, l.line_no, l.item_name, l.sku, l.batch_no, l.mfg_date,
      l.expiry_date, l.unit, l.packages, l.declared_qty, v_acc, v_short, v_dmg,
      round((v_acc + v_dmg) * v_unit_w, 3), l.storage_type, l.required_temp_c, l.condition, l.remarks)
    returning id into v_line_id;

    v_put_good := 0; v_put_dmg := 0; v_codes := '{}';
    for p in select e from jsonb_array_elements(coalesce(p_placements, '[]'::jsonb)) e
             where e ->> 'gate_entry_line_id' = l.id::text loop
      v_used := v_used + 1;
      v_qty := (p ->> 'quantity')::numeric;
      v_cond := coalesce(nullif(p ->> 'condition', ''), 'GOOD')::public.stock_condition;
      if v_qty is null or v_qty <= 0 then
        raise exception 'Placement quantity must be positive (line %)', l.line_no using errcode = 'WMS06';
      end if;

      s := public.occupy_slot((p ->> 'slot_id')::uuid, g.client_id, g.warehouse_id, l.storage_type,
                              l.required_temp_c, round(v_qty * v_unit_w, 3), 'INWARD_RECEIPT', v_receipt, v_today);

      insert into public.stock_items (
        client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, sku, batch_no, mfg_date, expiry_date,
        unit, quantity, packages, unit_weight_kg, weight_kg, condition, storage_type, required_temp_c,
        inward_receipt_id, inward_line_id, received_at)
      values (
        g.client_id, g.warehouse_id, s.zone_id, s.id, s.code, l.item_name, l.sku, l.batch_no, l.mfg_date,
        l.expiry_date, l.unit, v_qty,
        case when l.declared_qty > 0 then round(l.packages * v_qty / l.declared_qty)::integer else 0 end,
        v_unit_w, round(v_qty * v_unit_w, 3), v_cond, l.storage_type, l.required_temp_c,
        v_receipt, v_line_id, now())
      returning id into v_item;

      insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, to_slot_id,
                                          qty_delta, weight_delta, document_type, document_id, reason)
      values ('IN', v_item, g.client_id, g.warehouse_id, s.id, v_qty, round(v_qty * v_unit_w, 3),
              'INWARD_RECEIPT', v_receipt, 'Inward ' || v_no);

      if v_cond = 'GOOD' then v_put_good := v_put_good + v_qty; else v_put_dmg := v_put_dmg + v_qty; end if;
      if not (s.code = any (v_codes)) then v_codes := v_codes || s.code; end if;
    end loop;

    if v_put_good <> v_acc or v_put_dmg <> v_dmg then
      raise exception 'Line %: placed % good + % damaged, but counted % good + % damaged',
        l.line_no, v_put_good, v_put_dmg, v_acc, v_dmg using errcode = 'WMS06';
    end if;
    update public.inward_receipt_lines set slot_codes = v_codes where id = v_line_id;
  end loop;

  if v_used <> jsonb_array_length(coalesce(p_placements, '[]'::jsonb)) then
    raise exception 'Some placements refer to lines that are not on this gate entry' using errcode = 'WMS06';
  end if;

  for x in select e from jsonb_array_elements(coalesce(p_labour, '[]'::jsonb)) e loop
    insert into public.labour_entries (warehouse_id, client_id, document_type, document_id, activity,
                                       packages, tonnes, workers, hours, remarks)
    values (g.warehouse_id, g.client_id, 'INWARD_RECEIPT', v_receipt, (x ->> 'activity')::public.labour_activity,
            coalesce((x ->> 'packages')::integer, 0), coalesce((x ->> 'tonnes')::numeric, 0),
            (x ->> 'workers')::integer, coalesce((x ->> 'hours')::numeric, 0), nullif(x ->> 'remarks', ''));
  end loop;

  update public.gate_entries
     set status = 'RECEIVED',
         unloading_start_at = coalesce(unloading_start_at, gate_in_at),
         unloading_end_at = coalesce(unloading_end_at, now())
   where id = g.id;

  return v_receipt;
end;
$$;
