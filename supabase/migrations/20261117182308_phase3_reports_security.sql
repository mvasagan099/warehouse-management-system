-- =====================================================================
-- Phase 3: reports and exports, RLS, audit, grants.
-- Reports are SECURITY INVOKER: row level security decides what each role sees (managers: own warehouses only).
-- =====================================================================
create or replace function public._rupees(p bigint) returns text language sql immutable set search_path = ''
as $$ select to_char(p / 100.0, 'FM999999999990.00') $$;

create or replace function public.report_revenue(p_from date, p_to date, p_group text default 'month')
returns table (bucket text, rent_paise bigint, labour_paise bigint, other_paise bigint, tax_paise bigint, total_paise bigint)
language sql stable set search_path = ''
as $$
  with f as (
    select i.invoice_date d, i.client_id, i.warehouse_id, i.rent_taxable_paise r, i.labour_taxable_paise l, i.other_taxable_paise o, i.tax_paise t, i.grand_total_paise g
      from public.invoices i where i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.invoice_date between p_from and p_to
    union all
    select n.note_date, n.client_id, n.warehouse_id,
           (case n.kind when 'CREDIT' then -1 else 1 end) * coalesce((select sum(x.taxable_paise) from public.adjustment_note_lines x where x.note_id = n.id and x.section = 'RENT'), 0),
           (case n.kind when 'CREDIT' then -1 else 1 end) * coalesce((select sum(x.taxable_paise) from public.adjustment_note_lines x where x.note_id = n.id and x.section = 'LABOUR'), 0),
           (case n.kind when 'CREDIT' then -1 else 1 end) * coalesce((select sum(x.taxable_paise) from public.adjustment_note_lines x where x.note_id = n.id and x.section = 'OTHER'), 0),
           (case n.kind when 'CREDIT' then -1 else 1 end) * n.tax_paise, (case n.kind when 'CREDIT' then -1 else 1 end) * n.grand_total_paise
      from public.adjustment_notes n where n.note_date between p_from and p_to)
  select case p_group when 'client' then c.company_name when 'warehouse' then w.code || ' · ' || w.name else to_char(f.d, 'YYYY-MM') end b,
         sum(f.r)::bigint, sum(f.l)::bigint, sum(f.o)::bigint, sum(f.t)::bigint, sum(f.g)::bigint
  from f join public.clients c on c.id = f.client_id join public.warehouses w on w.id = f.warehouse_id
  group by 1 order by 1
$$;

create or replace function public.report_utilisation(p_from date, p_to date)
returns table (warehouse_id uuid, warehouse text, held_brigade_days bigint, billed_brigade_days bigint, available_brigade_days bigint, utilisation_bp integer)
language sql stable set search_path = ''
as $$
  select w.id, w.code || ' · ' || w.name,
         coalesce((select sum(o.brigades) from public.daily_occupancy o where o.warehouse_id = w.id and o.occ_date between p_from and p_to), 0)::bigint,
         coalesce((select sum(o.brigades - o.free_brigades) from public.daily_occupancy o where o.warehouse_id = w.id and o.occ_date between p_from and p_to
                   and exists (select 1 from public.invoices i where i.client_id = o.client_id and i.warehouse_id = o.warehouse_id
                               and i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.rent_range @> o.occ_date)), 0)::bigint,
         ((select count(*) from public.brigade_slots s where s.warehouse_id = w.id and s.deleted_at is null) * (p_to - p_from + 1))::bigint,
         case when (select count(*) from public.brigade_slots s where s.warehouse_id = w.id and s.deleted_at is null) = 0 then 0
              else (coalesce((select sum(o.brigades) from public.daily_occupancy o where o.warehouse_id = w.id and o.occ_date between p_from and p_to), 0) * 10000
                    / ((select count(*) from public.brigade_slots s where s.warehouse_id = w.id and s.deleted_at is null) * (p_to - p_from + 1)))::integer end
  from public.warehouses w where w.deleted_at is null order by 2
$$;

-- GSTR-1 style sales register: invoices (B2B with GSTIN, B2C without) and credit / debit notes, one row per section and tax rate.
create or replace function public.gstr1_register(p_from date, p_to date)
returns table (category text, doc_type text, doc_no text, doc_date date, party_name text, gstin text, place_of_supply text, section text,
               sac_code text, gst_rate_bp integer, taxable_paise bigint, cgst_paise bigint, sgst_paise bigint, igst_paise bigint, exempt_reason text)
language sql stable set search_path = ''
as $$
  select case when i.client_snapshot ->> 'gstin' is null then 'B2C' else 'B2B' end, 'INVOICE', i.invoice_no, i.invoice_date, i.client_snapshot ->> 'name', i.client_snapshot ->> 'gstin',
         i.place_of_supply, t.section::text, t.sac_code, t.gst_rate_bp, t.taxable_paise, t.cgst_paise, t.sgst_paise, t.igst_paise, t.exempt_reason
  from public.invoices i join public.invoice_tax_lines t on t.invoice_id = i.id
  where i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and i.invoice_date between p_from and p_to
  union all
  select case when c.gstin is null then 'B2C' else 'B2B' end, case n.kind when 'CREDIT' then 'CREDIT_NOTE' else 'DEBIT_NOTE' end, n.note_no, n.note_date, c.company_name, c.gstin,
         n.place_of_supply, l.section::text, l.sac_code, l.gst_rate_bp, l.taxable_paise, l.cgst_paise, l.sgst_paise, l.igst_paise, l.exempt_reason
  from public.adjustment_notes n join public.adjustment_note_lines l on l.note_id = n.id join public.clients c on c.id = n.client_id
  where n.note_date between p_from and p_to
  order by 4, 3, 8
$$;

-- Tally-compatible XML (Import Data -> Vouchers): sales vouchers for invoices, receipt vouchers for payments.
create or replace function public.tally_export_xml(p_from date, p_to date)
returns text language plpgsql stable set search_path = ''
as $$
declare v text := ''; i record; p record;
begin
  if not (public.is_admin() or public.is_accountant()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  for i in select * from public.invoices where status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') and invoice_date between p_from and p_to order by invoice_date, invoice_no loop
    v := v || xmlelement(name "TALLYMESSAGE", xmlattributes('TallyUDF' as "xmlns:UDF"), xmlelement(name "VOUCHER", xmlattributes('Sales' as "VCHTYPE", 'Create' as "ACTION"),
      xmlelement(name "DATE", to_char(i.invoice_date, 'YYYYMMDD')), xmlelement(name "VOUCHERTYPENAME", 'Sales'), xmlelement(name "VOUCHERNUMBER", i.invoice_no),
      xmlelement(name "PARTYLEDGERNAME", i.client_snapshot ->> 'name'), xmlelement(name "NARRATION", format('Invoice for %s to %s', i.period_from, i.period_to)),
      xmlelement(name "ALLLEDGERENTRIES.LIST", xmlelement(name "LEDGERNAME", i.client_snapshot ->> 'name'), xmlelement(name "ISDEEMEDPOSITIVE", 'Yes'), xmlelement(name "AMOUNT", '-' || public._rupees(i.grand_total_paise))),
      (select xmlagg(xmlelement(name "ALLLEDGERENTRIES.LIST", xmlelement(name "LEDGERNAME", x.n), xmlelement(name "ISDEEMEDPOSITIVE", 'No'), xmlelement(name "AMOUNT", public._rupees(x.a))))
         from (values ('Warehouse Rent', i.rent_taxable_paise), ('Labour Charges', i.labour_taxable_paise), ('Other Charges', i.other_taxable_paise),
                      ('CGST', i.cgst_paise), ('SGST', i.sgst_paise), ('IGST', i.igst_paise), ('Round Off', i.round_off_paise)) x(n, a) where x.a <> 0)))::text;
  end loop;
  for p in select pm.*, c.company_name from public.payments pm join public.clients c on c.id = pm.client_id where pm.status = 'RECORDED' and pm.paid_on between p_from and p_to order by pm.paid_on, pm.payment_no loop
    v := v || xmlelement(name "TALLYMESSAGE", xmlattributes('TallyUDF' as "xmlns:UDF"), xmlelement(name "VOUCHER", xmlattributes('Receipt' as "VCHTYPE", 'Create' as "ACTION"),
      xmlelement(name "DATE", to_char(p.paid_on, 'YYYYMMDD')), xmlelement(name "VOUCHERTYPENAME", 'Receipt'), xmlelement(name "VOUCHERNUMBER", p.payment_no),
      xmlelement(name "PARTYLEDGERNAME", p.company_name), xmlelement(name "NARRATION", concat_ws(' ', p.method::text, p.reference)),
      xmlelement(name "ALLLEDGERENTRIES.LIST", xmlelement(name "LEDGERNAME", p.company_name), xmlelement(name "ISDEEMEDPOSITIVE", 'No'), xmlelement(name "AMOUNT", public._rupees(p.amount_paise))),
      xmlelement(name "ALLLEDGERENTRIES.LIST", xmlelement(name "LEDGERNAME", case when p.method = 'CASH' then 'Cash' else 'Bank Account' end), xmlelement(name "ISDEEMEDPOSITIVE", 'Yes'), xmlelement(name "AMOUNT", '-' || public._rupees(p.amount_paise)))))::text;
  end loop;
  return '<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>' || v || '</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>';
end;
$$;

-- ---------- RLS ----------
alter table public.invoices            enable row level security;
alter table public.invoice_lines       enable row level security;
alter table public.invoice_tax_lines   enable row level security;
alter table public.adjustment_notes    enable row level security;
alter table public.adjustment_note_lines enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.reminder_queue      enable row level security;
alter table public.billing_job_log     enable row level security;

-- drafts are visible to admin and accountant only; issued invoices to their warehouse managers and their client
create policy invoices_select on public.invoices for select to authenticated
  using (public.is_admin() or public.is_accountant()
         or (status not in ('DRAFT', 'CANCELLED') and (public.manages_warehouse(warehouse_id) or public.is_my_client(client_id))));
create policy invoice_lines_select on public.invoice_lines for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy invoice_tax_lines_select on public.invoice_tax_lines for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy adjustment_notes_select on public.adjustment_notes for select to authenticated using (public.can_view_billing(warehouse_id, client_id));
create policy adjustment_note_lines_select on public.adjustment_note_lines for select to authenticated using (exists (select 1 from public.adjustment_notes n where n.id = note_id));
create policy payments_select on public.payments for select to authenticated using (public.can_view_billing(warehouse_id, client_id));
create policy payment_allocations_select on public.payment_allocations for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id));
create policy reminder_queue_select on public.reminder_queue for select to authenticated using (public.is_admin() or public.is_accountant());
create policy billing_job_log_select on public.billing_job_log for select to authenticated using (public.is_admin() or public.is_accountant());

-- ---------- private bucket for invoice PDFs (generated in the browser, e-mailed by an Edge Function) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('invoices', 'invoices', false, 5242880, array['application/pdf']) on conflict (id) do nothing;
create policy wms_invoices_insert on storage.objects for insert to authenticated with check (bucket_id = 'invoices' and (public.is_admin() or public.is_accountant()));
create policy wms_invoices_update on storage.objects for update to authenticated using (bucket_id = 'invoices' and public.is_admin()) with check (bucket_id = 'invoices' and public.is_admin());
create policy wms_invoices_select on storage.objects for select to authenticated using (bucket_id = 'invoices' and (public.is_admin() or public.is_accountant()
  or exists (select 1 from public.invoices i where i.pdf_path = name and (public.manages_warehouse(i.warehouse_id) or public.is_my_client(i.client_id)))));

-- ---------- audit: every create, update, issue and cancel ----------
do $$
declare t text;
begin
  foreach t in array array['client_groups', 'tax_rules', 'other_charges', 'rate_cards', 'rent_rates', 'labour_rates', 'invoices', 'invoice_lines',
                           'adjustment_notes', 'adjustment_note_lines', 'payments', 'payment_allocations'] loop
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- ---------- grants ----------
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.daily_occupancy, public.occupancy_runs, public.invoices, public.invoice_lines, public.invoice_tax_lines,
  public.adjustment_notes, public.adjustment_note_lines, public.payments, public.payment_allocations, public.reminder_queue, public.billing_job_log from authenticated;
revoke execute on all functions in schema public from anon, public;
do $$
declare f text;
begin
  foreach f in array array[
    'rates_guard()', 'invoices_guard()', 'invoice_children_guard()', 'notes_guard()', '_emit_rent_line(uuid, uuid, uuid, public.storage_type, numeric, numeric, date, date, integer, integer, numeric, uuid, public.rent_basis, bigint, text)',
    '_draft_rent_lines(uuid, uuid, uuid, date, date)', '_draft_labour_lines(uuid, uuid, uuid, date)', '_doc_outstanding(text, uuid)', '_allocate_to(uuid, text, uuid, bigint)', '_allocate_fifo(uuid)',
    'alloc_counts_on(date, date, date)', 'alloc_days(date, date)', 'free_days_for(uuid, uuid, date)', 'resolve_rate_terms(uuid, uuid, date)', 'resolve_tax_rule(public.invoice_section, public.storage_type, date)',
    'setting_json(text)', 'gst_split(bigint, integer, text, boolean)', 'supply_kind_for(uuid)', 'invoice_outstanding(uuid)', 'recalculate_invoice(uuid)', 'refresh_invoice_state(uuid)', 'apply_advances(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
end $$;
