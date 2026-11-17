-- =====================================================================
-- Phase 3: credit/debit notes, payments, ledger, ageing, overdue, credit block, scheduled billing.
-- =====================================================================
create table public.adjustment_notes (
  id uuid primary key default gen_random_uuid(),
  note_no text not null unique,
  kind public.note_kind not null,
  invoice_id uuid not null references public.invoices(id),
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  note_date date not null,
  reason text not null check (length(trim(reason)) > 0),
  supply_kind text not null, place_of_supply text,
  taxable_paise bigint not null, cgst_paise bigint not null default 0, sgst_paise bigint not null default 0, igst_paise bigint not null default 0,
  tax_paise bigint not null, total_before_round_paise bigint not null, round_off_paise bigint not null, grand_total_paise bigint not null,
  paid_paise bigint not null default 0,          -- debit notes: collected so far
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index adjustment_notes_invoice_idx on public.adjustment_notes (invoice_id);
create index adjustment_notes_client_idx on public.adjustment_notes (client_id);
create table public.adjustment_note_lines (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.adjustment_notes(id),
  section public.invoice_section not null,
  description text not null,
  taxable_paise bigint not null check (taxable_paise > 0),
  sac_code text, gst_rate_bp integer not null,
  exempt boolean not null default false, exempt_reason text,
  cgst_paise bigint not null default 0, sgst_paise bigint not null default 0, igst_paise bigint not null default 0
);
create index adjustment_note_lines_note_idx on public.adjustment_note_lines (note_id);

create or replace function public.notes_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare k text[] := array['paid_paise', 'updated_at'];
begin
  if tg_table_name = 'adjustment_note_lines' or tg_op = 'DELETE' then
    raise exception 'Credit and debit notes cannot be edited or deleted' using errcode = 'WMS25';
  end if;
  if old.grand_total_paise > 0 and (to_jsonb(new) - k) is distinct from (to_jsonb(old) - k) then
    raise exception 'Credit and debit notes cannot be edited' using errcode = 'WMS25';
  end if;
  return new;
end;
$$;
create trigger adjustment_notes_guard before update or delete on public.adjustment_notes for each row execute function public.notes_guard();
create trigger adjustment_note_lines_guard before update or delete on public.adjustment_note_lines for each row execute function public.notes_guard();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  amount_paise bigint not null check (amount_paise > 0),
  method public.payment_method not null,
  reference text,
  paid_on date not null,
  external_ref text unique,                     -- e.g. Razorpay payment id: makes webhook retries idempotent
  status text not null default 'RECORDED' check (status in ('RECORDED', 'REVERSED')),
  reversed_reason text, reversed_at timestamptz,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id);
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  doc_type text not null check (doc_type in ('INVOICE', 'DEBIT_NOTE')),
  doc_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  created_at timestamptz not null default now()
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_doc_idx on public.payment_allocations (doc_type, doc_id);
create trigger set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.adjustment_notes for each row execute function public.set_updated_at();

create table public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  client_id uuid not null references public.clients(id),
  days_after_due integer not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  error text, created_at timestamptz not null default now(), sent_at timestamptz,
  unique (invoice_id, days_after_due)
);
create table public.billing_job_log (
  id bigint generated always as identity primary key,
  job text not null, client_id uuid, warehouse_id uuid, ok boolean not null, message text, created_at timestamptz not null default now()
);

-- ---------- invoice payment state ----------
create or replace function public.refresh_invoice_state(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.invoices; v_out bigint;
begin
  select * into i from public.invoices where id = p_invoice_id;
  if not found or i.status in ('DRAFT', 'CANCELLED') then return; end if;
  v_out := i.grand_total_paise - i.paid_paise - i.credit_paise;
  update public.invoices set status = case when v_out <= 0 then 'PAID'::public.invoice_status
                                           when i.due_date < public.today_ist() then 'OVERDUE'::public.invoice_status
                                           when i.paid_paise + i.credit_paise > 0 then 'PARTIALLY_PAID'::public.invoice_status
                                           else 'ISSUED'::public.invoice_status end
  where id = p_invoice_id;
end;
$$;

create or replace function public._doc_outstanding(p_type text, p_id uuid)
returns bigint language sql stable security definer set search_path = ''
as $$
  select case p_type when 'INVOICE' then (select i.grand_total_paise - i.paid_paise - i.credit_paise from public.invoices i where i.id = p_id)
                     else (select n.grand_total_paise - n.paid_paise from public.adjustment_notes n where n.id = p_id and n.kind = 'DEBIT') end
$$;

create or replace function public._allocate_to(p_payment uuid, p_type text, p_id uuid, p_max bigint)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare v_out bigint := public._doc_outstanding(p_type, p_id); v_take bigint;
begin
  v_take := least(coalesce(v_out, 0), p_max);
  if v_take <= 0 then return 0; end if;
  insert into public.payment_allocations (payment_id, doc_type, doc_id, amount_paise) values (p_payment, p_type, p_id, v_take);
  if p_type = 'INVOICE' then update public.invoices set paid_paise = paid_paise + v_take where id = p_id; perform public.refresh_invoice_state(p_id);
  else update public.adjustment_notes set paid_paise = paid_paise + v_take where id = p_id; end if;
  return v_take;
end;
$$;

-- Oldest open invoice / debit note first.
create or replace function public._allocate_fifo(p_payment uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare pay public.payments; v_left bigint; d record;
begin
  select * into pay from public.payments where id = p_payment and status = 'RECORDED';
  if not found then return; end if;
  v_left := pay.amount_paise - coalesce((select sum(amount_paise) from public.payment_allocations where payment_id = p_payment), 0);
  for d in
    select 'INVOICE' t, i.id, i.invoice_date dt, i.issued_at ts from public.invoices i
      where i.client_id = pay.client_id and i.status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') and i.grand_total_paise - i.paid_paise - i.credit_paise > 0
    union all
    select 'DEBIT_NOTE', n.id, n.note_date, n.created_at from public.adjustment_notes n
      where n.client_id = pay.client_id and n.kind = 'DEBIT' and n.grand_total_paise - n.paid_paise > 0
    order by 3, 4
  loop
    exit when v_left <= 0;
    v_left := v_left - public._allocate_to(p_payment, d.t, d.id, v_left);
  end loop;
end;
$$;

create or replace function public.apply_advances(p_client_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare p record;
begin
  for p in select id from public.payments where client_id = p_client_id and status = 'RECORDED'
           and amount_paise > coalesce((select sum(a.amount_paise) from public.payment_allocations a where a.payment_id = payments.id), 0)
           order by paid_on, created_at loop
    perform public._allocate_fifo(p.id);
  end loop;
end;
$$;

create or replace function public.record_payment(p_client_id uuid, p_warehouse_id uuid, p_amount_paise bigint, p_method public.payment_method,
    p_reference text, p_paid_on date, p_invoice_id uuid default null, p_external_ref text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_dep bigint;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Only an administrator can record payments' using errcode = '42501'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'The amount must be positive' using errcode = '22023'; end if;
  if not exists (select 1 from public.clients where id = p_client_id and deleted_at is null) then raise exception 'Client not found' using errcode = 'P0002'; end if;
  if p_external_ref is not null then
    select id into v_id from public.payments where external_ref = p_external_ref;
    if found then return v_id; end if;                    -- webhook retry: already recorded
  end if;
  if p_method = 'DEPOSIT_ADJUSTMENT' then
    v_dep := coalesce((select sum(security_deposit_paise) from public.contracts where client_id = p_client_id and deleted_at is null and status = 'ACTIVE'), 0)
           - coalesce((select sum(amount_paise) from public.payments where client_id = p_client_id and method = 'DEPOSIT_ADJUSTMENT' and status = 'RECORDED'), 0);
    if p_amount_paise > v_dep then raise exception 'Only % paise of the security deposit is left to adjust', v_dep using errcode = 'WMS27'; end if;
  end if;
  insert into public.payments (payment_no, client_id, warehouse_id, amount_paise, method, reference, paid_on, external_ref, notes)
  values (public.next_doc_number(p_warehouse_id, 'PAY'), p_client_id, p_warehouse_id, p_amount_paise, p_method, nullif(p_reference, ''), p_paid_on, p_external_ref, p_notes)
  returning id into v_id;
  if p_invoice_id is not null then
    if not exists (select 1 from public.invoices where id = p_invoice_id and client_id = p_client_id) then raise exception 'Invoice does not belong to this client' using errcode = '22023'; end if;
    perform public._allocate_to(v_id, 'INVOICE', p_invoice_id, p_amount_paise);   -- the rest stays as an advance
  else
    perform public._allocate_fifo(v_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare pay public.payments; a record;
begin
  if not public.is_admin() then raise exception 'Only an administrator can reverse a payment' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into pay from public.payments where id = p_payment_id for update;
  if not found or pay.status <> 'RECORDED' then raise exception 'Payment not found or already reversed' using errcode = 'WMS03'; end if;
  for a in select * from public.payment_allocations where payment_id = p_payment_id loop
    if a.doc_type = 'INVOICE' then update public.invoices set paid_paise = paid_paise - a.amount_paise where id = a.doc_id; perform public.refresh_invoice_state(a.doc_id);
    else update public.adjustment_notes set paid_paise = paid_paise - a.amount_paise where id = a.doc_id; end if;
  end loop;
  delete from public.payment_allocations where payment_id = p_payment_id;
  update public.payments set status = 'REVERSED', reversed_reason = p_reason, reversed_at = now() where id = p_payment_id;
end;
$$;

-- ---------- credit / debit notes (same sections and tax split as the invoice) ----------
-- p_lines: [{section, description, taxable_paise, sac_code?, gst_rate_bp?}]. For a CREDIT note with no lines the whole invoice is reversed.
create or replace function public.issue_adjustment_note(p_invoice_id uuid, p_kind public.note_kind, p_reason text, p_lines jsonb default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare inv public.invoices; v_id uuid; v_no text; x jsonb; t record; s record; v_sec public.invoice_section; v_tax bigint; v_tot bigint; v_grand bigint; v_ex boolean;
  v_taxable bigint := 0; v_c bigint := 0; v_s bigint := 0; v_i bigint := 0; v_sac text; v_rate integer; v_amt bigint; v_exr text;
begin
  if not public.is_admin() then raise exception 'Only an administrator can issue credit or debit notes' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or inv.status in ('DRAFT', 'CANCELLED') then raise exception 'Notes can only be raised against an issued invoice' using errcode = 'WMS25'; end if;
  v_ex := coalesce((inv.client_snapshot ->> 'gst_exempt')::boolean, false);
  v_exr := (select coalesce(c.gst_exempt_reason, 'Exempt') from public.clients c where c.id = inv.client_id);
  if p_lines is null then
    if p_kind <> 'CREDIT' then raise exception 'A debit note needs its lines' using errcode = '22023'; end if;
    p_lines := (select jsonb_agg(jsonb_build_object('section', tl.section, 'description', 'Reversal of ' || lower(tl.section::text) || ' charges',
                'taxable_paise', tl.taxable_paise, 'sac_code', tl.sac_code, 'gst_rate_bp', tl.gst_rate_bp)) from public.invoice_tax_lines tl where tl.invoice_id = inv.id and tl.taxable_paise > 0);
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'The note has no lines' using errcode = 'WMS20'; end if;
  v_no := public.next_doc_number(inv.warehouse_id, case p_kind when 'CREDIT' then 'CN' else 'DN' end);
  insert into public.adjustment_notes (note_no, kind, invoice_id, client_id, warehouse_id, note_date, reason, supply_kind, place_of_supply,
      taxable_paise, tax_paise, total_before_round_paise, round_off_paise, grand_total_paise)
  values (v_no, p_kind, inv.id, inv.client_id, inv.warehouse_id, public.today_ist(), p_reason, inv.supply_kind, inv.place_of_supply, 0, 0, 0, 0, 0) returning id into v_id;
  for x in select e from jsonb_array_elements(p_lines) e loop
    v_sec := (x ->> 'section')::public.invoice_section; v_amt := (x ->> 'taxable_paise')::bigint;
    select * into t from public.resolve_tax_rule(v_sec, null, public.today_ist());
    v_sac := coalesce(x ->> 'sac_code', t.sac_code); v_rate := coalesce((x ->> 'gst_rate_bp')::integer, t.gst_rate_bp);
    if v_rate is null then raise exception 'No tax rule for %', v_sec using errcode = 'WMS23'; end if;
    select * into s from public.gst_split(v_amt, v_rate, inv.supply_kind, v_ex);
    insert into public.adjustment_note_lines (note_id, section, description, taxable_paise, sac_code, gst_rate_bp, exempt, exempt_reason, cgst_paise, sgst_paise, igst_paise)
    values (v_id, v_sec, coalesce(nullif(x ->> 'description', ''), initcap(lower(v_sec::text))), v_amt, v_sac, case when v_ex then 0 else v_rate end, v_ex, case when v_ex then v_exr end, s.cgst, s.sgst, s.igst);
    v_taxable := v_taxable + v_amt; v_c := v_c + s.cgst; v_s := v_s + s.sgst; v_i := v_i + s.igst;
  end loop;
  v_tax := v_c + v_s + v_i; v_tot := v_taxable + v_tax; v_grand := ((v_tot + 50) / 100) * 100;
  if p_kind = 'CREDIT' and v_grand > inv.grand_total_paise - inv.credit_paise then
    raise exception 'The credit note (% paise) exceeds what is left to credit on this invoice', v_grand using errcode = 'WMS28';
  end if;
  update public.adjustment_notes set taxable_paise = v_taxable, cgst_paise = v_c, sgst_paise = v_s, igst_paise = v_i, tax_paise = v_tax,
         total_before_round_paise = v_tot, round_off_paise = v_grand - v_tot, grand_total_paise = v_grand where id = v_id;
  if p_kind = 'CREDIT' then
    update public.invoices set credit_paise = credit_paise + v_grand where id = inv.id;
    perform public.refresh_invoice_state(inv.id);
  else
    perform public.apply_advances(inv.client_id);
  end if;
  return v_id;
end;
$$;

-- ---------- ledger and ageing (security invoker: row level security decides what each role sees) ----------
create or replace function public.client_ledger(p_client_id uuid, p_from date default null, p_to date default null)
returns table (entry_date date, doc_type text, doc_no text, description text, debit_paise bigint, credit_paise bigint, balance_paise bigint, doc_id uuid)
language sql stable set search_path = ''
as $$
  with e as (
    select i.invoice_date d, i.issued_at ts, 'INVOICE'::text t, i.invoice_no n, format('Invoice %s to %s', i.period_from, i.period_to) ds, i.grand_total_paise db, 0::bigint cr, i.id
      from public.invoices i where i.client_id = p_client_id and i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')
    union all select n.note_date, n.created_at, case n.kind when 'DEBIT' then 'DEBIT_NOTE' else 'CREDIT_NOTE' end, n.note_no, n.reason,
        case when n.kind = 'DEBIT' then n.grand_total_paise else 0 end, case when n.kind = 'CREDIT' then n.grand_total_paise else 0 end, n.id
      from public.adjustment_notes n where n.client_id = p_client_id
    union all select p.paid_on, p.created_at, 'PAYMENT', p.payment_no, concat_ws(' ', p.method::text, p.reference), 0, p.amount_paise, p.id
      from public.payments p where p.client_id = p_client_id
    union all select p.reversed_at::date, p.reversed_at, 'PAYMENT_REVERSAL', p.payment_no, p.reversed_reason, p.amount_paise, 0, p.id
      from public.payments p where p.client_id = p_client_id and p.status = 'REVERSED'
  ), o as (select e.*, sum(e.db - e.cr) over (order by e.d, e.ts, e.id) bal from e)
  select o.d, o.t, o.n, o.ds, o.db, o.cr, o.bal::bigint, o.id from o
  where (p_from is null or o.d >= p_from) and (p_to is null or o.d <= p_to) order by o.d, o.ts, o.id
$$;

-- Ageing by days since the invoice (or debit note) date.
create or replace function public.ageing_report(p_as_of date default null)
returns table (client_id uuid, client_name text, b0_30 bigint, b31_60 bigint, b61_90 bigint, b90_plus bigint, outstanding_paise bigint, advance_paise bigint, net_paise bigint)
language sql stable set search_path = ''
as $$
  with d as (
    select i.client_id, coalesce(p_as_of, public.today_ist()) - i.invoice_date age, i.grand_total_paise - i.paid_paise - i.credit_paise o
      from public.invoices i where i.status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
    union all
    select n.client_id, coalesce(p_as_of, public.today_ist()) - n.note_date, n.grand_total_paise - n.paid_paise from public.adjustment_notes n where n.kind = 'DEBIT'
  ), a as (
    select b.client_id, sum(b.amount_paise - coalesce((select sum(x.amount_paise) from public.payment_allocations x where x.payment_id = b.id), 0)) adv
      from public.payments b where b.status = 'RECORDED' group by b.client_id
  ), s as (
    select d.client_id, coalesce(sum(d.o) filter (where d.age <= 30), 0) a1, coalesce(sum(d.o) filter (where d.age between 31 and 60), 0) a2,
           coalesce(sum(d.o) filter (where d.age between 61 and 90), 0) a3, coalesce(sum(d.o) filter (where d.age > 90), 0) a4, coalesce(sum(d.o), 0) tot
      from d where d.o > 0 group by d.client_id
  )
  select c.id, c.company_name, coalesce(s.a1, 0), coalesce(s.a2, 0), coalesce(s.a3, 0), coalesce(s.a4, 0), coalesce(s.tot, 0), coalesce(a.adv, 0),
         coalesce(s.tot, 0) - coalesce(a.adv, 0)
  from public.clients c left join s on s.client_id = c.id left join a on a.client_id = c.id
  where coalesce(s.tot, 0) > 0 or coalesce(a.adv, 0) > 0 order by c.company_name
$$;

-- ---------- overdue and reminders ----------
create or replace function public.mark_overdue_invoices()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_n integer; v_cfg jsonb := coalesce(public.setting_json('reminders'), '{"enabled":true,"days_after_due":[1,7,15]}'::jsonb); d integer;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.invoices set status = 'OVERDUE'
   where status in ('ISSUED', 'PARTIALLY_PAID') and due_date < public.today_ist() and grand_total_paise - paid_paise - credit_paise > 0;
  get diagnostics v_n = row_count;
  if coalesce((v_cfg ->> 'enabled')::boolean, true) then
    for d in select (e)::integer from jsonb_array_elements_text(v_cfg -> 'days_after_due') e loop
      insert into public.reminder_queue (invoice_id, client_id, days_after_due)
      select i.id, i.client_id, d from public.invoices i
      where i.status = 'OVERDUE' and public.today_ist() - i.due_date >= d
      on conflict (invoice_id, days_after_due) do nothing;
    end loop;
  end if;
  return v_n;
end;
$$;

-- ---------- credit block (setting) with an admin override ----------
create or replace function public.billing_block_reason(p_client_id uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare cfg jsonb := coalesce(public.setting_json('billing_block'), '{}'::jsonb); c public.clients; v_out bigint; v_days integer;
begin
  if not coalesce((cfg ->> 'enabled')::boolean, false) then return null; end if;
  if auth.uid() is not null and not (public.is_admin() or public.is_accountant() or public.current_app_role() = 'WAREHOUSE_MANAGER' or public.is_my_client(p_client_id)) then return null; end if;
  select * into c from public.clients where id = p_client_id;
  if not found or (c.billing_override_until is not null and c.billing_override_until >= public.today_ist()) then return null; end if;
  select coalesce(sum(i.grand_total_paise - i.paid_paise - i.credit_paise), 0) into v_out from public.invoices i where i.client_id = p_client_id and i.status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE');
  v_out := v_out + coalesce((select sum(n.grand_total_paise - n.paid_paise) from public.adjustment_notes n where n.client_id = p_client_id and n.kind = 'DEBIT'), 0);
  v_out := v_out - coalesce((select sum(p.amount_paise - coalesce((select sum(a.amount_paise) from public.payment_allocations a where a.payment_id = p.id), 0))
                             from public.payments p where p.client_id = p_client_id and p.status = 'RECORDED'), 0);
  if coalesce((cfg ->> 'block_over_credit_limit')::boolean, true) and c.credit_limit_paise > 0 and v_out > c.credit_limit_paise then
    return format('Outstanding %s paise is over the credit limit of %s paise', v_out, c.credit_limit_paise);
  end if;
  v_days := coalesce((cfg ->> 'overdue_days')::integer, 30);
  if exists (select 1 from public.invoices i where i.client_id = p_client_id and i.status = 'OVERDUE' and public.today_ist() - i.due_date > v_days) then
    return format('An invoice is overdue by more than %s days', v_days);
  end if;
  return null;
end;
$$;

create or replace function public.set_billing_override(p_client_id uuid, p_until date, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can override the credit block' using errcode = '42501'; end if;
  if p_until is not null and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  update public.clients set billing_override_until = p_until, billing_override_reason = case when p_until is null then null else p_reason end where id = p_client_id;
end;
$$;

-- ---------- scheduled draft generation (cron) ----------
create or replace function public.generate_scheduled_drafts(p_today date default null)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_today date := coalesce(p_today, public.today_ist()); r record; v_from date; v_to date; v_n integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  for r in select distinct c.id cid, c.billing_cycle cyc, k.warehouse_id wid from public.clients c
           join public.contracts k on k.client_id = c.id and k.deleted_at is null and k.status = 'ACTIVE'
           where c.deleted_at is null and c.status = 'ACTIVE' and c.billing_cycle <> 'ON_DEMAND' loop
    v_from := null;
    if r.cyc = 'WEEKLY' and extract(isodow from v_today) = 1 then v_from := v_today - 7; v_to := v_today - 1;
    elsif r.cyc = 'MONTHLY' and extract(day from v_today) = 1 then v_from := (v_today - interval '1 month')::date; v_to := v_today - 1; end if;
    continue when v_from is null;
    if exists (select 1 from public.invoices i where i.client_id = r.cid and i.warehouse_id = r.wid and i.status <> 'CANCELLED' and i.period_from = v_from and i.period_to = v_to) then continue; end if;
    begin
      perform public.generate_invoice_draft(r.cid, r.wid, v_from, v_to);
      v_n := v_n + 1;
      insert into public.billing_job_log (job, client_id, warehouse_id, ok, message) values ('drafts', r.cid, r.wid, true, format('%s to %s', v_from, v_to));
    exception when others then
      insert into public.billing_job_log (job, client_id, warehouse_id, ok, message) values ('drafts', r.cid, r.wid, sqlerrm like 'Nothing to bill%', sqlerrm);
    end;
  end loop;
  return v_n;
end;
$$;

-- 00:30 India = 19:00 UTC (overdue), 00:40 India = 19:10 UTC (drafts). pg_cron schedules are UTC.
do $$ begin perform cron.unschedule('wms-mark-overdue'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('wms-generate-invoices'); exception when others then null; end $$;
select cron.schedule('wms-mark-overdue', '0 19 * * *', $cron$select public.mark_overdue_invoices()$cron$);
select cron.schedule('wms-generate-invoices', '10 19 * * *', $cron$select public.generate_scheduled_drafts()$cron$);
