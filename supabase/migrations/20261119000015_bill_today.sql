-- Immediate billing: today can be billed and counts as a full day, including slots that were emptied by a dispatch today.
-- Today's occupancy snapshot is provisional (no occupancy_runs row), so it is recomputed until the day is invoiced; invoiced days never change.
do $$
declare def text; r record; hits int := 0;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('snapshot_occupancy', 'snapshot_occupancy_backfill', 'generate_invoice_draft') loop
    def := pg_get_functiondef(r.oid);
    if r.proname = 'snapshot_occupancy' then
      def := replace(def, 'if p_date >= public.today_ist() then', 'if p_date > public.today_ist() then');
      def := replace(def, 'public.alloc_counts_on(a.start_date, a.end_date, p_date)', '(public.alloc_counts_on(a.start_date, a.end_date, p_date) or (p_date = public.today_ist() and a.end_date = p_date))');
      def := replace(def, 'insert into public.occupancy_runs (occ_date, row_count) values (p_date, v_n)
  on conflict (occ_date) do update set run_at = now(), row_count = excluded.row_count;',
        'if p_date < public.today_ist() then
    insert into public.occupancy_runs (occ_date, row_count) values (p_date, v_n)
    on conflict (occ_date) do update set run_at = now(), row_count = excluded.row_count;
  end if;');
    elsif r.proname = 'snapshot_occupancy_backfill' then
      def := replace(def, 'least(coalesce(p_to, public.today_ist() - 1), public.today_ist() - 1)', 'least(coalesce(p_to, public.today_ist() - 1), public.today_ist())');
    else
      def := replace(def, 'if p_to >= public.today_ist() then', 'if p_to > public.today_ist() then');
      def := replace(def, 'Only finished days can be billed: the period must end on or before %'', public.today_ist() - 1', 'The period cannot end in the future: the last day you can bill is %'', public.today_ist()');
    end if;
    execute def; hits := hits + 1;
  end loop;
  if hits <> 3 then raise exception 'expected to update 3 functions, updated %', hits; end if;
end $$;

create or replace function public.quick_bill(p_client_id uuid, p_warehouse_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_from date; v_to date := public.today_ist(); v_id uuid; v_no text; v_total bigint;
begin
  if not public.is_admin() then raise exception 'Only an administrator can bill' using errcode = '42501'; end if;
  select max(i.period_to) + 1 into v_from from public.invoices i where i.client_id = p_client_id and i.warehouse_id = p_warehouse_id and i.status <> 'CANCELLED';
  if v_from is null then
    select least(
      (select min(a.start_date) from public.slot_allocations a where a.client_id = p_client_id and a.warehouse_id = p_warehouse_id and not a.cancelled),
      (select min((l.created_at at time zone 'Asia/Kolkata')::date) from public.labour_entries l where l.client_id = p_client_id and l.warehouse_id = p_warehouse_id and not l.cancelled)) into v_from;
  end if;
  if v_from is null or v_from > v_to then raise exception 'Nothing to bill: everything up to today is already invoiced.' using errcode = 'WMS20'; end if;
  v_id := public.generate_invoice_draft(p_client_id, p_warehouse_id, v_from, v_to);
  v_no := public.issue_invoice(v_id);
  select grand_total_paise - paid_paise - credit_paise into v_total from public.invoices where id = v_id;
  return jsonb_build_object('invoice_id', v_id, 'invoice_no', v_no, 'due_paise', v_total, 'period_from', v_from, 'period_to', v_to);
end $$;
revoke execute on all functions in schema public from anon, public;
