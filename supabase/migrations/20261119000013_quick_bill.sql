-- One-step billing at the counter (administrator): invoice everything for this client and warehouse that is not invoiced yet, up to yesterday
-- (the existing rule: only finished days are billed, so today's rent and today's loading labour go on the next invoice), then issue it.
create or replace function public.quick_bill(p_client_id uuid, p_warehouse_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_from date; v_to date := public.today_ist() - 1; v_id uuid; v_no text; v_total bigint;
begin
  if not public.is_admin() then raise exception 'Only an administrator can bill' using errcode = '42501'; end if;
  select max(i.period_to) + 1 into v_from from public.invoices i where i.client_id = p_client_id and i.warehouse_id = p_warehouse_id and i.status <> 'CANCELLED';
  if v_from is null then
    select least(
      (select min(a.start_date) from public.slot_allocations a where a.client_id = p_client_id and a.warehouse_id = p_warehouse_id and not a.cancelled),
      (select min((l.created_at at time zone 'Asia/Kolkata')::date) from public.labour_entries l where l.client_id = p_client_id and l.warehouse_id = p_warehouse_id and not l.cancelled)) into v_from;
  end if;
  if v_from is null or v_from > v_to then raise exception 'Nothing to bill yet: everything up to yesterday is already invoiced. Today''s charges go on the next invoice.' using errcode = 'WMS20'; end if;
  v_id := public.generate_invoice_draft(p_client_id, p_warehouse_id, v_from, v_to);
  v_no := public.issue_invoice(v_id);
  select grand_total_paise - paid_paise - credit_paise into v_total from public.invoices where id = v_id;
  return jsonb_build_object('invoice_id', v_id, 'invoice_no', v_no, 'due_paise', v_total, 'period_from', v_from, 'period_to', v_to);
end $$;
revoke execute on all functions in schema public from anon, public;
