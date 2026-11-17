-- =====================================================================
-- Phase 3 hooks into Phase 2:
--  * labour facts can be flagged night / overtime
--  * optional credit block on new bookings and dispatch requests (WMS24)
--  * a receipt or challan that is on an invoice cannot be cancelled
-- =====================================================================
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
                                       packages, tonnes, workers, hours, remarks, is_night, is_overtime)
    values (g.warehouse_id, g.client_id, 'INWARD_RECEIPT', v_receipt, (x ->> 'activity')::public.labour_activity,
            coalesce((x ->> 'packages')::integer, 0), coalesce((x ->> 'tonnes')::numeric, 0),
            (x ->> 'workers')::integer, coalesce((x ->> 'hours')::numeric, 0), nullif(x ->> 'remarks', ''),
            coalesce((x ->> 'is_night')::boolean, false), coalesce((x ->> 'is_overtime')::boolean, false));
  end loop;

  update public.gate_entries
     set status = 'RECEIVED',
         unloading_start_at = coalesce(unloading_start_at, gate_in_at),
         unloading_end_at = coalesce(unloading_end_at, now())
   where id = g.id;

  return v_receipt;
end;
$$;

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
                                       packages, tonnes, workers, hours, remarks, is_night, is_overtime)
    values (r.warehouse_id, r.client_id, 'DELIVERY_CHALLAN', v_challan, (x ->> 'activity')::public.labour_activity,
            coalesce((x ->> 'packages')::integer, 0), coalesce((x ->> 'tonnes')::numeric, 0),
            (x ->> 'workers')::integer, coalesce((x ->> 'hours')::numeric, 0), nullif(x ->> 'remarks', ''),
            coalesce((x ->> 'is_night')::boolean, false), coalesce((x ->> 'is_overtime')::boolean, false));
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

create or replace function public.space_bookings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.status := 'REQUESTED';
  new.reserved_count := 0;
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  new.booking_no := null;
  new.requested_by := auth.uid();
  if not public.client_has_active_contract(new.client_id, new.warehouse_id, new.from_date) then
    raise exception 'Client has no active contract with this warehouse on %', new.from_date using errcode = 'WMS14';
  end if;
  if public.billing_block_reason(new.client_id) is not null then
    raise exception 'New requests are blocked: %', public.billing_block_reason(new.client_id) using errcode = 'WMS24';
  end if;
  return new;
end;
$$;

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
  if public.billing_block_reason(new.client_id) is not null then
    raise exception 'New requests are blocked: %', public.billing_block_reason(new.client_id) using errcode = 'WMS24';
  end if;
  if not public.company_belongs_to_client(new.to_company_id, new.client_id) then
    raise exception 'Company does not belong to this client' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.billed_document_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' and old.billed_invoice_id is not null then
    raise exception 'This document is already on an invoice; issue a credit note instead of cancelling it' using errcode = 'WMS29';
  end if;
  return new;
end;
$$;
create trigger billed_document_guard before update on public.inward_receipts   for each row execute function public.billed_document_guard();
create trigger billed_document_guard before update on public.delivery_challans for each row execute function public.billed_document_guard();
revoke execute on function public.billed_document_guard() from authenticated;
