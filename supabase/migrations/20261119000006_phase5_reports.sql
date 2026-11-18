-- =====================================================================
-- Phase 5 / 5: one report engine for the on-screen reports and their CSV / PDF exports.
-- SECURITY INVOKER: row level security decides what each role sees, exactly as for the tables themselves.
-- Returns {total, rows}; the screen asks for 100 rows, an export asks page by page.
-- =====================================================================
create or replace function public.report_rows(p_report text, p_from date, p_to date, p_warehouse uuid default null, p_client uuid default null, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable set search_path = ''
as $$
declare
  v_from timestamptz := ((coalesce(p_from, date '2000-01-01')::text || ' 00:00:00+05:30')::timestamptz);
  v_to   timestamptz := ((coalesce(p_to, date '2999-12-31')::text || ' 23:59:59.999+05:30')::timestamptz);
  v_lim integer := least(greatest(coalesce(p_limit, 100), 1), 5000);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint; v_rows jsonb;
begin
  if p_report = 'stock' then
    select count(*) into v_total from public.stock_items s where s.deleted_at is null and s.quantity > 0 and (p_warehouse is null or s.warehouse_id = p_warehouse) and (p_client is null or s.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select c.company_name client, w.code warehouse, s.slot_code slot, s.item_name item, s.sku, s.batch_no batch, s.expiry_date expiry, s.quantity, s.unit, s.weight_kg
      from public.stock_items s join public.clients c on c.id = s.client_id join public.warehouses w on w.id = s.warehouse_id
      where s.deleted_at is null and s.quantity > 0 and (p_warehouse is null or s.warehouse_id = p_warehouse) and (p_client is null or s.client_id = p_client)
      order by c.company_name, s.item_name, s.id limit v_lim offset v_off) r;
  elsif p_report = 'expiry' then
    select count(*) into v_total from public.stock_items s where s.deleted_at is null and s.quantity > 0 and s.expiry_date between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or s.warehouse_id = p_warehouse) and (p_client is null or s.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select c.company_name client, w.code warehouse, s.slot_code slot, s.item_name item, s.batch_no batch, s.expiry_date expiry, s.quantity, s.unit
      from public.stock_items s join public.clients c on c.id = s.client_id join public.warehouses w on w.id = s.warehouse_id
      where s.deleted_at is null and s.quantity > 0 and s.expiry_date between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or s.warehouse_id = p_warehouse) and (p_client is null or s.client_id = p_client)
      order by s.expiry_date, s.id limit v_lim offset v_off) r;
  elsif p_report = 'receipts' then
    select count(*) into v_total from public.inward_receipts x where x.deleted_at is null and x.received_at between v_from and v_to and (p_warehouse is null or x.warehouse_id = p_warehouse) and (p_client is null or x.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select x.receipt_no "number", (x.received_at at time zone 'Asia/Kolkata')::date date, c.company_name client, w.code warehouse, x.status::text status
      from public.inward_receipts x join public.clients c on c.id = x.client_id join public.warehouses w on w.id = x.warehouse_id
      where x.deleted_at is null and x.received_at between v_from and v_to and (p_warehouse is null or x.warehouse_id = p_warehouse) and (p_client is null or x.client_id = p_client)
      order by x.received_at desc, x.id limit v_lim offset v_off) r;
  elsif p_report = 'challans' then
    select count(*) into v_total from public.delivery_challans x where x.deleted_at is null and x.dispatched_at between v_from and v_to and (p_warehouse is null or x.warehouse_id = p_warehouse) and (p_client is null or x.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select x.challan_no "number", (x.dispatched_at at time zone 'Asia/Kolkata')::date date, c.company_name client, w.code warehouse, x.dispatch_temp_c temp_c, x.status::text status
      from public.delivery_challans x join public.clients c on c.id = x.client_id join public.warehouses w on w.id = x.warehouse_id
      where x.deleted_at is null and x.dispatched_at between v_from and v_to and (p_warehouse is null or x.warehouse_id = p_warehouse) and (p_client is null or x.client_id = p_client)
      order by x.dispatched_at desc, x.id limit v_lim offset v_off) r;
  elsif p_report = 'movements' then
    select count(*) into v_total from public.stock_movements m where m.created_at between v_from and v_to and (p_warehouse is null or m.warehouse_id = p_warehouse) and (p_client is null or m.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select (m.created_at at time zone 'Asia/Kolkata')::date date, m.movement_type::text type, c.company_name client, w.code warehouse, m.qty_delta quantity, m.weight_delta weight_kg, m.document_type document, m.reason
      from public.stock_movements m join public.clients c on c.id = m.client_id join public.warehouses w on w.id = m.warehouse_id
      where m.created_at between v_from and v_to and (p_warehouse is null or m.warehouse_id = p_warehouse) and (p_client is null or m.client_id = p_client)
      order by m.created_at desc, m.id desc limit v_lim offset v_off) r;
  elsif p_report = 'labour' then
    select count(*) into v_total from public.labour_entries l where not l.cancelled and l.created_at between v_from and v_to and (p_warehouse is null or l.warehouse_id = p_warehouse) and (p_client is null or l.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select (l.created_at at time zone 'Asia/Kolkata')::date date, l.document_type document, l.activity::text activity, c.company_name client, w.code warehouse, l.packages, l.tonnes, l.workers, l.hours
      from public.labour_entries l join public.clients c on c.id = l.client_id join public.warehouses w on w.id = l.warehouse_id
      where not l.cancelled and l.created_at between v_from and v_to and (p_warehouse is null or l.warehouse_id = p_warehouse) and (p_client is null or l.client_id = p_client)
      order by l.created_at desc, l.id limit v_lim offset v_off) r;
  elsif p_report = 'invoices' then
    select count(*) into v_total from public.invoices i where i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.invoice_date between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or i.warehouse_id = p_warehouse) and (p_client is null or i.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select i.invoice_no "number", i.invoice_date date, c.company_name client, w.code warehouse, i.status::text status, i.taxable_paise taxable_paise, i.tax_paise tax_paise, i.grand_total_paise total_paise, i.paid_paise paid_paise
      from public.invoices i join public.clients c on c.id = i.client_id join public.warehouses w on w.id = i.warehouse_id
      where i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.invoice_date between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or i.warehouse_id = p_warehouse) and (p_client is null or i.client_id = p_client)
      order by i.invoice_date desc, i.id limit v_lim offset v_off) r;
  elsif p_report = 'payments' then
    select count(*) into v_total from public.payments p where p.paid_on between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or p.warehouse_id = p_warehouse) and (p_client is null or p.client_id = p_client);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select p.payment_no "number", p.paid_on date, c.company_name client, p.method::text method, p.reference, p.status, p.amount_paise amount_paise
      from public.payments p join public.clients c on c.id = p.client_id
      where p.paid_on between coalesce(p_from, date '2000-01-01') and coalesce(p_to, date '2999-12-31') and (p_warehouse is null or p.warehouse_id = p_warehouse) and (p_client is null or p.client_id = p_client)
      order by p.paid_on desc, p.id limit v_lim offset v_off) r;
  elsif p_report = 'crew' then
    select count(*) into v_total from public.crew_log g where g.created_at between v_from and v_to and (p_warehouse is null or g.warehouse_id = p_warehouse);
    select coalesce(jsonb_agg(r), '[]') into v_rows from (
      select (g.created_at at time zone 'Asia/Kolkata')::date date, w.code warehouse, g.document_type document, coalesce(ir.receipt_no, dc.challan_no) "number", pr.full_name worker
      from public.crew_log g join public.warehouses w on w.id = g.warehouse_id join public.profiles pr on pr.id = g.user_id
      left join public.inward_receipts ir on g.document_type = 'INWARD_RECEIPT' and ir.id = g.document_id left join public.delivery_challans dc on g.document_type = 'DELIVERY_CHALLAN' and dc.id = g.document_id
      where g.created_at between v_from and v_to and (p_warehouse is null or g.warehouse_id = p_warehouse)
      order by g.created_at desc, g.id limit v_lim offset v_off) r;
  else
    raise exception 'Unknown report' using errcode = 'WMS57';
  end if;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;
revoke execute on all functions in schema public from anon, public;
