-- =====================================================================
-- Phase 5 / 6: row security that stays fast on big tables.
-- A policy that calls a SECURITY DEFINER function once per row cost ~0.4 ms a row (43 s to count 100,000 stock rows). The caller's reach is the
-- same for every row of a statement, so it is worked out ONCE per statement ("(select ...)" makes Postgres evaluate it as an InitPlan) and each
-- row then only needs a cheap membership test. Who can see what is unchanged: the RLS matrix test passes before and after.
-- =====================================================================
create or replace function public.readable_warehouse_ids() returns uuid[] language sql stable security definer set search_path = ''
as $$
  select case public.current_app_role()
    when 'SUPER_ADMIN' then coalesce((select array_agg(id) from public.warehouses), '{}')
    when 'WAREHOUSE_MANAGER' then coalesce((select array_agg(wm.warehouse_id) from public.warehouse_managers wm where wm.user_id = auth.uid() and wm.deleted_at is null), '{}')
    when 'STAFF' then coalesce((select array[p.warehouse_id] from public.profiles p where p.id = auth.uid() and p.warehouse_id is not null), '{}')
    else '{}'::uuid[] end
$$;
create or replace function public.managed_warehouse_ids() returns uuid[] language sql stable security definer set search_path = ''
as $$
  select case when public.current_app_role() = 'WAREHOUSE_MANAGER'
    then coalesce((select array_agg(wm.warehouse_id) from public.warehouse_managers wm where wm.user_id = auth.uid() and wm.deleted_at is null), '{}') else '{}'::uuid[] end
$$;

-- warehouse and client rows: admin, or a warehouse the caller works in, or the caller's own client
do $$
declare t text;
begin
  foreach t in array array['stock_items', 'stock_movements', 'inward_receipts', 'inward_receipt_lines', 'delivery_challans', 'delivery_challan_lines', 'dispatch_requests',
                           'dispatch_request_lines', 'gate_entries', 'gate_entry_lines', 'slot_allocations', 'space_bookings'] loop
    execute format('alter policy %I on public.%I using ((select public.is_admin()) or warehouse_id = any ((select public.readable_warehouse_ids())) or client_id = (select public.current_client_id()))', t || '_select', t);
  end loop;
end $$;

-- warehouse-only rows
alter policy labour_entries_select on public.labour_entries using ((select public.is_admin()) or warehouse_id = any ((select public.readable_warehouse_ids())));
alter policy dispatch_picks_select on public.dispatch_picks using ((select public.is_admin()) or warehouse_id = any ((select public.readable_warehouse_ids())));
alter policy audit_logs_select on public.audit_logs using ((select public.is_admin()));

-- billing rows: admin, accountant, the manager of the warehouse, the client itself
alter policy payments_select on public.payments using ((select public.is_admin()) or (select public.is_accountant()) or warehouse_id = any ((select public.managed_warehouse_ids())) or client_id = (select public.current_client_id()));
alter policy adjustment_notes_select on public.adjustment_notes using ((select public.is_admin()) or (select public.is_accountant()) or warehouse_id = any ((select public.managed_warehouse_ids())) or client_id = (select public.current_client_id()));
alter policy invoices_select on public.invoices using (
  (select public.is_admin()) or (select public.is_accountant())
  or (status <> all (array['DRAFT'::public.invoice_status, 'CANCELLED'::public.invoice_status])
      and (warehouse_id = any ((select public.managed_warehouse_ids())) or client_id = (select public.current_client_id()))));

revoke execute on all functions in schema public from anon, public;
-- (these two stay executable by signed-in users: row security policies run with the caller's own privileges)
