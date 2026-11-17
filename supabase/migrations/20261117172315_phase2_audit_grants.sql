-- =====================================================================
-- Phase 2: audit triggers on every new table, dashboard view update,
-- function privileges.
-- =====================================================================

-- Every insert / update / delete (so every status change) lands in audit_logs.
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings', 'doc_types', 'clients', 'contracts', 'company_master', 'space_bookings',
    'gate_entries', 'gate_entry_lines', 'inward_receipts', 'inward_receipt_lines', 'stock_items',
    'slot_allocations', 'labour_entries', 'dispatch_requests', 'dispatch_request_lines', 'dispatch_picks',
    'delivery_challans', 'delivery_challan_lines'
  ] loop
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
-- stock_movements is itself an append-only ledger, so it is not audited twice.

-- Dashboard: add RESERVED slots (new column at the end keeps the view compatible).
create or replace view public.v_zone_slot_summary
with (security_invoker = true)
as
select
  w.id            as warehouse_id,
  w.code          as warehouse_code,
  w.name          as warehouse_name,
  z.id            as zone_id,
  z.code          as zone_code,
  z.name          as zone_name,
  z.storage_type  as storage_type,
  z.temp_min,
  z.temp_max,
  count(s.id)::integer                                       as total_slots,
  (count(s.id) filter (where s.status = 'FREE'))::integer     as free_slots,
  (count(s.id) filter (where s.status = 'OCCUPIED'))::integer as occupied_slots,
  (count(s.id) filter (where s.status = 'BLOCKED'))::integer  as blocked_slots,
  (count(s.id) filter (where s.status = 'RESERVED'))::integer as reserved_slots
from public.warehouses w
join public.zones z
  on z.warehouse_id = w.id and z.deleted_at is null
left join public.brigade_slots s
  on s.zone_id = z.id and s.deleted_at is null
where w.deleted_at is null
group by w.id, w.code, w.name, z.id, z.code, z.name, z.storage_type, z.temp_min, z.temp_max;

-- ---------- Function privileges ----------
-- Internal building blocks and trigger functions: never callable through the API.
do $$
declare f text;
begin
  foreach f in array array[
    'next_doc_number(uuid, text, date)', 'assign_doc_number()', 'normalise_gst_party()',
    'brigade_slots_guard()', 'space_bookings_guard()', 'gate_entries_normalise()', 'gate_entries_guard()',
    'gate_entry_lines_sync()', 'gate_entry_lines_guard()', 'dispatch_requests_guard()',
    'dispatch_request_lines_sync()', 'forbid_change()', 'handle_new_user()', 'handle_user_app_metadata()',
    'profiles_guard()',
    'occupy_slot(uuid, uuid, uuid, public.storage_type, numeric, numeric, text, uuid, date)',
    'release_slot_if_empty(uuid, date, text, uuid)', 'slot_load_kg(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Helpers used inside RLS policies, check constraints and invoker triggers,
-- plus the RPCs the app calls. Each RPC checks the caller's role itself.
do $$
declare f text;
begin
  foreach f in array array[
    'today_ist()', 'financial_year_label(date)', 'is_valid_gstin(text)',
    'zone_matches_temp(public.storage_type, numeric, numeric, public.storage_type, numeric, numeric, numeric)',
    'current_client_id()', 'is_my_client(uuid)', 'can_operate_warehouse(uuid)',
    'client_has_active_contract(uuid, uuid, date)', 'client_sees_warehouse(uuid)', 'can_see_client(uuid)',
    'can_view_row(uuid, uuid)', 'company_belongs_to_client(uuid, uuid)', 'path_warehouse_id(text)', 'stock_reserved_qty(uuid)', 'stock_available_qty(uuid)',
    'check_space_availability(uuid, public.storage_type, numeric, numeric, numeric, uuid)',
    'approve_booking(uuid, text)', 'reject_booking(uuid, text)', 'cancel_booking(uuid, text)',
    'suggest_inward_slots(uuid, jsonb)', 'confirm_inward_receipt(uuid, jsonb, jsonb, jsonb, text)',
    'approve_dispatch_request(uuid, text)', 'reject_dispatch_request(uuid, text)',
    'cancel_dispatch_request(uuid, text)', 'record_pick_scan(uuid, text)',
    'confirm_delivery_challan(uuid, uuid, numeric, text, text, text, jsonb, text)',
    'record_challan_pod(uuid, text, text)', 'transfer_stock(uuid, uuid, numeric, text)',
    'adjust_stock(uuid, numeric, text)', 'cancel_inward_receipt(uuid, text)', 'cancel_delivery_challan(uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete on public.doc_counters from authenticated;
