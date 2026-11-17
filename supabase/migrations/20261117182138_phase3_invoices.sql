-- =====================================================================
-- Phase 3: invoices, GST, generation from rent (occupancy) and labour (receipts / challans), issue, e-invoice JSON.
-- Error codes:  WMS20 nothing to bill   WMS21 rate already used   WMS22 period not finished
--               WMS23 no rate / tax rule   WMS25 invoice immutable   WMS26 period already billed
-- =====================================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique,
  client_id uuid not null references public.clients(id),
  warehouse_id uuid not null references public.warehouses(id),
  status public.invoice_status not null default 'DRAFT',
  billing_mode public.billing_mode not null,
  period_from date not null, period_to date not null,
  rent_range daterange,
  invoice_date date, due_date date,
  supply_kind text not null default 'INTRA' check (supply_kind in ('INTRA', 'INTER', 'CONSUMER')),
  place_of_supply text,
  supplier_snapshot jsonb, client_snapshot jsonb,
  rent_taxable_paise bigint not null default 0, labour_taxable_paise bigint not null default 0, other_taxable_paise bigint not null default 0,
  taxable_paise bigint not null default 0,
  cgst_paise bigint not null default 0, sgst_paise bigint not null default 0, igst_paise bigint not null default 0, tax_paise bigint not null default 0,
  total_before_round_paise bigint not null default 0, round_off_paise bigint not null default 0, grand_total_paise bigint not null default 0,
  paid_paise bigint not null default 0, credit_paise bigint not null default 0,
  irn text, qr_code text, ack_no text, ack_date timestamptz,
  pdf_path text, emailed_at timestamptz,
  generated_by uuid, issued_by uuid, issued_at timestamptz, cancel_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint invoices_period check (period_to >= period_from),
  constraint invoices_rent_not_twice exclude using gist (client_id with =, warehouse_id with =, rent_range with &&)
    where (rent_range is not null and status <> 'CANCELLED')
);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_warehouse_idx on public.invoices (warehouse_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_due_idx on public.invoices (due_date);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  section public.invoice_section not null,
  line_no integer not null,
  description text not null,
  doc_type text, doc_id uuid, doc_no text, lorry_number text,
  storage_type public.storage_type, temp_min numeric(5,2), temp_max numeric(5,2),
  from_date date, to_date date,
  quantity numeric(16,3) not null default 1, unit text not null default 'nos',
  rate_paise bigint not null default 0,
  rate_ids uuid[] not null default '{}',
  rate_source text,
  amount_paise bigint not null default 0,
  discount_paise bigint not null default 0,
  taxable_paise bigint not null default 0,
  sac_code text, gst_rate_bp integer not null default 0,
  exempt boolean not null default false, exempt_reason text,
  allocation_ids uuid[] not null default '{}',
  charge_id uuid references public.other_charges(id), percent_bp integer, percent_base text,
  manual boolean not null default false,
  fix_reason text, original_amount_paise bigint, fixed_by uuid, fixed_at timestamptz,
  calc_detail jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint invoice_lines_exempt check (not exempt or coalesce(trim(exempt_reason), '') <> '')
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index invoice_lines_rate_ids_idx on public.invoice_lines using gin (rate_ids);

create table public.invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  section public.invoice_section not null,
  sac_code text, gst_rate_bp integer not null,
  taxable_paise bigint not null, exempt boolean not null default false, exempt_reason text,
  cgst_paise bigint not null default 0, sgst_paise bigint not null default 0, igst_paise bigint not null default 0
);
create index invoice_tax_lines_invoice_idx on public.invoice_tax_lines (invoice_id);

alter table public.inward_receipts   add constraint inward_receipts_billed_fk   foreign key (billed_invoice_id) references public.invoices(id);
alter table public.delivery_challans add constraint delivery_challans_billed_fk foreign key (billed_invoice_id) references public.invoices(id);
alter table public.slot_allocations  add constraint slot_allocations_min_fk     foreign key (min_days_invoice_id) references public.invoices(id);

-- ---------- immutability ----------
create or replace function public.invoices_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare k text[] := array['status','paid_paise','credit_paise','irn','qr_code','ack_no','ack_date','pdf_path','emailed_at','updated_at'];
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices cannot be deleted' using errcode = 'WMS25';
  end if;
  if old.status <> 'DRAFT' then
    if new.status = 'DRAFT' or old.status = 'CANCELLED' then
      raise exception 'An issued invoice cannot go back to draft' using errcode = 'WMS25';
    end if;
    if (to_jsonb(new) - k) is distinct from (to_jsonb(old) - k) then
      raise exception 'Issued invoices cannot be edited; issue a credit or debit note' using errcode = 'WMS25';
    end if;
  end if;
  return new;
end;
$$;
create trigger invoices_guard before update or delete on public.invoices for each row execute function public.invoices_guard();

create or replace function public.invoice_children_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare s public.invoice_status;
begin
  select status into s from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if s is distinct from 'DRAFT' then
    raise exception 'Lines of an issued invoice cannot change' using errcode = 'WMS25';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines for each row execute function public.invoice_children_guard();
create trigger invoice_tax_lines_guard before insert or update or delete on public.invoice_tax_lines for each row execute function public.invoice_children_guard();
create trigger set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoice_lines for each row execute function public.set_updated_at();

-- ---------- GST ----------
-- Half the rate each for CGST and SGST (always equal), full rate for IGST; each amount rounded to the nearest paisa.
create or replace function public.gst_split(p_taxable bigint, p_rate_bp integer, p_supply_kind text, p_exempt boolean)
returns table (cgst bigint, sgst bigint, igst bigint)
language sql immutable set search_path = ''
as $$
  select case when p_exempt or p_supply_kind = 'INTER' then 0 else round(p_taxable::numeric * p_rate_bp / 20000)::bigint end,
         case when p_exempt or p_supply_kind = 'INTER' then 0 else round(p_taxable::numeric * p_rate_bp / 20000)::bigint end,
         case when p_exempt or p_supply_kind <> 'INTER' then 0 else round(p_taxable::numeric * p_rate_bp / 10000)::bigint end
$$;

-- Supplier state is a setting (Tamil Nadu = 33). No GSTIN = consumer, taxed by the supplier-state rule.
create or replace function public.supply_kind_for(p_client_id uuid)
returns table (kind text, place text)
language sql stable security definer set search_path = ''
as $$
  with s as (select coalesce(public.setting_json('supplier') ->> 'state_code', '33') as code)
  select case when c.gstin is null then 'CONSUMER' when c.state_code = s.code then 'INTRA' else 'INTER' end,
         case when c.gstin is null or c.state_code is null then s.code else c.state_code end
  from public.clients c, s where c.id = p_client_id
$$;

create or replace function public.invoice_outstanding(p_invoice_id uuid)
returns bigint language sql stable security definer set search_path = ''
as $$ select i.grand_total_paise - i.paid_paise - i.credit_paise from public.invoices i where i.id = p_invoice_id $$;

-- Recomputes percentage charges, taxable values, tax groups, totals and the whole-rupee round-off. Draft only.
create or replace function public.recalculate_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare inv public.invoices; c public.clients; v_rent bigint; v_lab bigint; v_oth bigint; v_tax bigint; v_total bigint; v_grand bigint;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if inv.status <> 'DRAFT' then raise exception 'Only a draft can be recalculated' using errcode = 'WMS25'; end if;
  select * into c from public.clients where id = inv.client_id;

  update public.invoice_lines l set
    amount_paise = round((case l.percent_base when 'RENT' then (select coalesce(sum(x.amount_paise - x.discount_paise), 0) from public.invoice_lines x where x.invoice_id = l.invoice_id and x.section = 'RENT')
                                              when 'LABOUR' then (select coalesce(sum(x.amount_paise - x.discount_paise), 0) from public.invoice_lines x where x.invoice_id = l.invoice_id and x.section = 'LABOUR')
                                              else (select coalesce(sum(x.amount_paise - x.discount_paise), 0) from public.invoice_lines x where x.invoice_id = l.invoice_id and x.section in ('RENT', 'LABOUR')) end)::numeric
                         * l.percent_bp / 10000)::bigint, discount_paise = 0
  where l.invoice_id = p_invoice_id and l.percent_bp is not null;
  update public.invoice_lines set taxable_paise = amount_paise - discount_paise where invoice_id = p_invoice_id;

  delete from public.invoice_tax_lines where invoice_id = p_invoice_id;
  insert into public.invoice_tax_lines (invoice_id, section, sac_code, gst_rate_bp, taxable_paise, exempt, exempt_reason, cgst_paise, sgst_paise, igst_paise)
  select p_invoice_id, g.section, g.sac_code, g.rate, g.taxable, g.ex, g.reason, s.cgst, s.sgst, s.igst
  from (select l.section, l.sac_code, case when l.exempt or c.gst_exempt then 0 else l.gst_rate_bp end as rate,
               sum(l.taxable_paise) as taxable, (l.exempt or c.gst_exempt) as ex,
               case when l.exempt or c.gst_exempt then coalesce(l.exempt_reason, c.gst_exempt_reason) end as reason
        from public.invoice_lines l where l.invoice_id = p_invoice_id
        group by l.section, l.sac_code, case when l.exempt or c.gst_exempt then 0 else l.gst_rate_bp end, (l.exempt or c.gst_exempt),
                 case when l.exempt or c.gst_exempt then coalesce(l.exempt_reason, c.gst_exempt_reason) end) g
  cross join lateral public.gst_split(g.taxable::bigint, g.rate::integer, inv.supply_kind, g.ex) s;

  select coalesce(sum(taxable_paise) filter (where section = 'RENT'), 0), coalesce(sum(taxable_paise) filter (where section = 'LABOUR'), 0),
         coalesce(sum(taxable_paise) filter (where section = 'OTHER'), 0) into v_rent, v_lab, v_oth
  from public.invoice_lines where invoice_id = p_invoice_id;
  select coalesce(sum(cgst_paise + sgst_paise + igst_paise), 0) into v_tax from public.invoice_tax_lines where invoice_id = p_invoice_id;
  v_total := v_rent + v_lab + v_oth + v_tax;
  v_grand := ((v_total + 50) / 100) * 100;
  update public.invoices set rent_taxable_paise = v_rent, labour_taxable_paise = v_lab, other_taxable_paise = v_oth,
    taxable_paise = v_rent + v_lab + v_oth,
    cgst_paise = (select coalesce(sum(cgst_paise), 0) from public.invoice_tax_lines where invoice_id = p_invoice_id),
    sgst_paise = (select coalesce(sum(sgst_paise), 0) from public.invoice_tax_lines where invoice_id = p_invoice_id),
    igst_paise = (select coalesce(sum(igst_paise), 0) from public.invoice_tax_lines where invoice_id = p_invoice_id),
    tax_paise = v_tax, total_before_round_paise = v_total, round_off_paise = v_grand - v_total, grand_total_paise = v_grand
  where id = p_invoice_id;
end;
$$;

-- ---------- rent lines ----------
create or replace function public._emit_rent_line(
  p_inv uuid, p_client uuid, p_wh uuid, p_st public.storage_type, p_tmin numeric, p_tmax numeric,
  p_from date, p_to date, p_chg integer, p_free integer, p_vol numeric,
  p_rate_id uuid, p_basis public.rent_basis, p_rate bigint, p_src text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_days integer := p_to - p_from + 1; v_qty numeric; v_amt bigint; v_disc bigint; t record; v_bp integer;
begin
  select * into t from public.resolve_tax_rule('RENT', p_st, p_to);
  if t.sac_code is null then raise exception 'No tax rule for rent (%)', p_st using errcode = 'WMS23'; end if;
  select coalesce((select rent_discount_bp from public.resolve_rate_terms(p_client, p_wh, p_from)), 0) into v_bp;
  if p_basis = 'PER_M3' then v_qty := p_vol * v_days; else v_qty := p_chg * v_days; end if;
  v_amt := round(v_qty * p_rate)::bigint;
  v_disc := round(v_amt::numeric * v_bp / 10000)::bigint;
  insert into public.invoice_lines (invoice_id, section, line_no, description, storage_type, temp_min, temp_max, from_date, to_date,
      quantity, unit, rate_paise, rate_ids, rate_source, amount_paise, discount_paise, taxable_paise, sac_code, gst_rate_bp, calc_detail)
  values (p_inv, 'RENT', (select coalesce(max(line_no), 0) + 1 from public.invoice_lines where invoice_id = p_inv),
      format('Storage %s%s: %s %s x %s day(s), %s to %s%s', p_st, case when p_tmin is not null then format(' (%s to %s C)', p_tmin, p_tmax) else '' end,
             p_chg, case when p_basis = 'PER_M3' then 'brigades (priced per m3)' else 'brigade(s)' end, v_days, p_from, p_to,
             case when p_free > 0 then format('; %s brigade-day(s) free', p_free) else '' end),
      p_st, p_tmin, p_tmax, p_from, p_to, v_qty, case when p_basis = 'PER_M3' then 'm3-days' else 'brigade-days' end, p_rate,
      array[p_rate_id], p_src, v_amt, v_disc, v_amt - v_disc, t.sac_code, t.gst_rate_bp,
      jsonb_build_object('brigades', p_chg, 'days', v_days, 'free_brigade_days', p_free, 'discount_bp', v_bp));
end;
$$;

create or replace function public._draft_rent_lines(p_inv uuid, p_client uuid, p_wh uuid, p_from date, p_to date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare g record; d record; r record; a record;
  v_n integer := 0; v_chg integer; v_key text; v_min integer;
  rs date; rl date; rkey text; rchg integer; rfree integer; rvol numeric; rid uuid; rbasis public.rent_basis; rrate bigint; rsrc text;
begin
  for g in select distinct o.storage_type, o.temp_min, o.temp_max, o.brigade_type_id from public.daily_occupancy o
           where o.client_id = p_client and o.warehouse_id = p_wh and o.occ_date between p_from and p_to
           order by 1, 2, 3, 4 loop
    rs := null;
    for d in select * from public.daily_occupancy o
             where o.client_id = p_client and o.warehouse_id = p_wh and o.occ_date between p_from and p_to
               and o.storage_type = g.storage_type and o.temp_min is not distinct from g.temp_min and o.temp_max is not distinct from g.temp_max
               and o.brigade_type_id = g.brigade_type_id order by o.occ_date loop
      v_chg := d.brigades - d.free_brigades;
      if v_chg <= 0 then
        if rs is not null then
          perform public._emit_rent_line(p_inv, p_client, p_wh, g.storage_type, g.temp_min, g.temp_max, rs, rl, rchg, rfree, rvol, rid, rbasis, rrate, rsrc);
          v_n := v_n + 1; rs := null;
        end if;
        continue;
      end if;
      select * into r from public.resolve_rent_rate(p_client, p_wh, g.storage_type, g.temp_min, g.temp_max, g.brigade_type_id, d.occ_date, d.brigades);
      if r.rent_rate_id is null then
        raise exception 'No rent rate for % on % (client rate card, group, warehouse or global default)', g.storage_type, d.occ_date using errcode = 'WMS23';
      end if;
      v_key := format('%s|%s|%s', v_chg, r.rent_rate_id, d.volume_m3);
      if rs is not null and rkey = v_key and d.occ_date = rl + 1 then
        rl := d.occ_date; rfree := rfree + d.free_brigades;
      else
        if rs is not null then
          perform public._emit_rent_line(p_inv, p_client, p_wh, g.storage_type, g.temp_min, g.temp_max, rs, rl, rchg, rfree, rvol, rid, rbasis, rrate, rsrc);
          v_n := v_n + 1;
        end if;
        rs := d.occ_date; rl := d.occ_date; rkey := v_key; rchg := v_chg; rfree := d.free_brigades;
        rvol := d.volume_m3 * v_chg / d.brigades; rid := r.rent_rate_id; rbasis := r.basis; rrate := r.rate_paise; rsrc := r.source;
      end if;
    end loop;
    if rs is not null then
      perform public._emit_rent_line(p_inv, p_client, p_wh, g.storage_type, g.temp_min, g.temp_max, rs, rl, rchg, rfree, rvol, rid, rbasis, rrate, rsrc);
      v_n := v_n + 1;
    end if;
  end loop;

  -- Minimum billing days: a Brigade released inside the period that was held for fewer days than the minimum is topped up once.
  for a in
    select z.storage_type st, z.temp_min tmin, z.temp_max tmax, al.brigade_type_id btid, bt.volume_m3 vol, al.id aid, al.end_date edate,
           greatest(coalesce((select t.min_billing_days from public.resolve_rate_terms(p_client, p_wh, al.end_date) t), 0),
                    coalesce((select max(k.min_days) from public.contracts k where k.client_id = p_client and k.warehouse_id = p_wh and k.deleted_at is null
                              and k.status = 'ACTIVE' and k.start_date <= al.end_date and (k.end_date is null or k.end_date >= al.end_date)), 0)) as mind,
           public.alloc_days(al.start_date, al.end_date) as held
    from public.slot_allocations al join public.zones z on z.id = al.zone_id join public.brigade_types bt on bt.id = al.brigade_type_id
    where al.client_id = p_client and al.warehouse_id = p_wh and not al.cancelled and al.min_days_invoice_id is null
      and al.end_date between p_from and p_to
  loop
    if a.held < a.mind then
      select * into r from public.resolve_rent_rate(p_client, p_wh, a.st, a.tmin, a.tmax, a.btid, a.edate, 1);
      if r.rent_rate_id is null then raise exception 'No rent rate for % on %', a.st, a.edate using errcode = 'WMS23'; end if;
      declare t record; v_qty numeric; v_amt bigint; v_disc bigint; v_bp integer;
      begin
        select * into t from public.resolve_tax_rule('RENT', a.st, a.edate);
        select coalesce((select rent_discount_bp from public.resolve_rate_terms(p_client, p_wh, a.edate)), 0) into v_bp;
        v_qty := case when r.basis = 'PER_M3' then a.vol * (a.mind - a.held) else (a.mind - a.held) end;
        v_amt := round(v_qty * r.rate_paise)::bigint; v_disc := round(v_amt::numeric * v_bp / 10000)::bigint;
        insert into public.invoice_lines (invoice_id, section, line_no, description, storage_type, temp_min, temp_max, from_date, to_date, quantity, unit,
            rate_paise, rate_ids, rate_source, amount_paise, discount_paise, taxable_paise, sac_code, gst_rate_bp, allocation_ids, calc_detail)
        values (p_inv, 'RENT', (select coalesce(max(line_no), 0) + 1 from public.invoice_lines where invoice_id = p_inv),
            format('Minimum billing top-up %s: held %s day(s), minimum %s, released %s', a.st, a.held, a.mind, a.edate),
            a.st, a.tmin, a.tmax, a.edate, a.edate, v_qty, case when r.basis = 'PER_M3' then 'm3-days' else 'brigade-days' end, r.rate_paise,
            array[r.rent_rate_id], r.source, v_amt, v_disc, v_amt - v_disc, t.sac_code, t.gst_rate_bp, array[a.aid],
            jsonb_build_object('held_days', a.held, 'minimum_days', a.mind));
        update public.slot_allocations set min_days_invoice_id = p_inv where id = a.aid;
        v_n := v_n + 1;
      end;
    end if;
  end loop;
  return v_n;
end;
$$;

-- ---------- labour lines: one per confirmed receipt / challan, from the Phase 2 labour facts ----------
create or replace function public._draft_labour_lines(p_inv uuid, p_client uuid, p_wh uuid, p_to date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare doc record; e record; r record; t record;
  v_n integer := 0; v_units numeric; v_base bigint; v_adj bigint; v_prem bigint; v_tot bigint; v_disc bigint; v_bp integer;
  v_cold numeric; v_all numeric; v_slots integer; v_parts text; v_detail jsonb; v_ids uuid[]; v_label text;
begin
  for doc in
    select 'INWARD_RECEIPT' as dtype, rc.id, rc.receipt_no as dno, ge.lorry_number, (rc.received_at at time zone 'Asia/Kolkata')::date as dt
    from public.inward_receipts rc join public.gate_entries ge on ge.id = rc.gate_entry_id
    where rc.client_id = p_client and rc.warehouse_id = p_wh and rc.status = 'CONFIRMED' and rc.billed_invoice_id is null
      and (rc.received_at at time zone 'Asia/Kolkata')::date <= p_to
    union all
    select 'DELIVERY_CHALLAN', dc.id, dc.challan_no, ge.lorry_number, (dc.dispatched_at at time zone 'Asia/Kolkata')::date
    from public.delivery_challans dc join public.gate_entries ge on ge.id = dc.gate_entry_id
    where dc.client_id = p_client and dc.warehouse_id = p_wh and dc.status = 'CONFIRMED' and dc.billed_invoice_id is null
      and (dc.dispatched_at at time zone 'Asia/Kolkata')::date <= p_to
    order by 5, 3
  loop
    if not exists (select 1 from public.labour_entries le where le.document_type = doc.dtype and le.document_id = doc.id and not le.cancelled) then continue; end if;
    if doc.dtype = 'INWARD_RECEIPT' then
      select coalesce(sum(l.packages) filter (where l.storage_type in ('CHILLED', 'FROZEN', 'DEEP_FREEZE') or l.required_temp_c < 8), 0), coalesce(sum(l.packages), 0)
        into v_cold, v_all from public.inward_receipt_lines l where l.receipt_id = doc.id;
      select count(distinct m.to_slot_id) into v_slots from public.stock_movements m where m.document_type = 'INWARD_RECEIPT' and m.document_id = doc.id and m.movement_type = 'IN';
    else
      select coalesce(sum(l.packages) filter (where z.storage_type in ('CHILLED', 'FROZEN', 'DEEP_FREEZE')), 0), coalesce(sum(l.packages), 0)
        into v_cold, v_all from public.delivery_challan_lines l join public.brigade_slots s on s.id = l.slot_id join public.zones z on z.id = s.zone_id where l.challan_id = doc.id;
      select count(distinct l.slot_id) into v_slots from public.delivery_challan_lines l where l.challan_id = doc.id;
    end if;
    v_tot := 0; v_parts := ''; v_detail := '[]'::jsonb; v_ids := '{}';
    for e in select * from public.labour_entries le where le.document_type = doc.dtype and le.document_id = doc.id and not le.cancelled order by le.created_at, le.id loop
      select * into r from public.resolve_labour_rate(p_client, p_wh, e.activity, doc.dt);
      if r.labour_rate_id is null then raise exception 'No labour rate for % on % (document %)', e.activity, doc.dt, doc.dno using errcode = 'WMS23'; end if;
      v_units := case r.basis when 'PER_PACKAGE' then e.packages when 'PER_TONNE' then e.tonnes when 'PER_HOUR' then e.workers * e.hours
                              when 'PER_BRIGADE_MOVED' then v_slots else 1 end;
      v_base := round(v_units * r.rate_paise)::bigint;
      v_adj := v_base;
      if e.is_night then v_adj := round(v_adj::numeric * r.night_multiplier_bp / 10000)::bigint; end if;
      if e.is_overtime then v_adj := round(v_adj::numeric * r.overtime_multiplier_bp / 10000)::bigint; end if;
      v_prem := 0;
      if v_all > 0 and v_cold > 0 then
        if r.cold_premium_type = 'PERCENT' then v_prem := round(v_adj::numeric * v_cold * r.cold_premium_value / (v_all * 10000))::bigint;
        elsif r.cold_premium_type = 'AMOUNT' then v_prem := round(v_units * r.cold_premium_value * v_cold / v_all)::bigint; end if;
      end if;
      v_tot := v_tot + v_adj + v_prem;
      v_ids := v_ids || r.labour_rate_id;
      v_label := format('%s %s %s', initcap(lower(e.activity::text)), trim(trailing '.' from trim(trailing '0' from v_units::text)), lower(replace(r.basis::text, 'PER_', '/')));
      v_parts := v_parts || case when v_parts = '' then '' else '; ' end || v_label
                 || case when e.is_night then ' night' else '' end || case when e.is_overtime then ' overtime' else '' end || case when v_prem > 0 then ' +cold premium' else '' end;
      v_detail := v_detail || jsonb_build_object('activity', e.activity, 'basis', r.basis, 'units', v_units, 'rate_paise', r.rate_paise, 'base_paise', v_base,
                   'after_multipliers_paise', v_adj, 'cold_premium_paise', v_prem, 'is_night', e.is_night, 'is_overtime', e.is_overtime, 'source', r.source);
    end loop;
    select * into t from public.resolve_tax_rule('LABOUR', null, doc.dt);
    if t.sac_code is null then raise exception 'No tax rule for labour' using errcode = 'WMS23'; end if;
    select coalesce((select labour_discount_bp from public.resolve_rate_terms(p_client, p_wh, doc.dt)), 0) into v_bp;
    v_disc := round(v_tot::numeric * v_bp / 10000)::bigint;
    insert into public.invoice_lines (invoice_id, section, line_no, description, doc_type, doc_id, doc_no, lorry_number, from_date, to_date, quantity, unit,
        rate_paise, rate_ids, rate_source, amount_paise, discount_paise, taxable_paise, sac_code, gst_rate_bp, calc_detail)
    values (p_inv, 'LABOUR', (select coalesce(max(line_no), 0) + 1 from public.invoice_lines where invoice_id = p_inv),
        format('%s %s, lorry %s: %s', case doc.dtype when 'INWARD_RECEIPT' then 'Inward receipt' else 'Delivery challan' end, doc.dno, doc.lorry_number, v_parts),
        doc.dtype, doc.id, doc.dno, doc.lorry_number, doc.dt, doc.dt, 1, 'document', v_tot, v_ids,
        (select string_agg(x ->> 'source', ' | ') from jsonb_array_elements(v_detail) x), v_tot, v_disc, v_tot - v_disc, t.sac_code, t.gst_rate_bp,
        jsonb_build_object('entries', v_detail, 'cold_packages', v_cold, 'total_packages', v_all, 'discount_bp', v_bp));
    if doc.dtype = 'INWARD_RECEIPT' then update public.inward_receipts set billed_invoice_id = p_inv where id = doc.id;
    else update public.delivery_challans set billed_invoice_id = p_inv where id = doc.id; end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.generate_invoice_draft(p_client_id uuid, p_warehouse_id uuid, p_from date, p_to date, p_mode public.billing_mode default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare c public.clients; v_id uuid; v_mode public.billing_mode; v_kind text; v_place text; v_n integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can generate invoices' using errcode = '42501';
  end if;
  select * into c from public.clients where id = p_client_id and deleted_at is null;
  if not found then raise exception 'Client not found' using errcode = 'P0002'; end if;
  if p_to < p_from then raise exception 'The period end is before its start' using errcode = '22023'; end if;
  if p_to >= public.today_ist() then
    raise exception 'Only finished days can be billed: the period must end on or before %', public.today_ist() - 1 using errcode = 'WMS22';
  end if;
  v_mode := coalesce(p_mode, c.billing_mode);
  select k.kind, k.place into v_kind, v_place from public.supply_kind_for(p_client_id) k;
  perform public.snapshot_occupancy_backfill(null, p_to);
  begin
    insert into public.invoices (client_id, warehouse_id, billing_mode, period_from, period_to, supply_kind, place_of_supply, generated_by,
                                 rent_range)
    values (p_client_id, p_warehouse_id, v_mode, p_from, p_to, v_kind, v_place, auth.uid(),
            case when v_mode in ('RENT_ONLY', 'BOTH') then daterange(p_from, p_to, '[]') end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Rent for part of this period is already on another invoice' using errcode = 'WMS26';
  end;
  if v_mode in ('RENT_ONLY', 'BOTH') then v_n := v_n + public._draft_rent_lines(v_id, p_client_id, p_warehouse_id, p_from, p_to); end if;
  if v_mode in ('LABOUR_ONLY', 'BOTH') then v_n := v_n + public._draft_labour_lines(v_id, p_client_id, p_warehouse_id, p_to); end if;
  if v_n = 0 then raise exception 'Nothing to bill for this client and period' using errcode = 'WMS20'; end if;
  perform public.recalculate_invoice(v_id);
  return v_id;
end;
$$;

-- ---------- draft editing (admin, with a reason) ----------
create or replace function public.fix_invoice_line(p_line_id uuid, p_amount_paise bigint, p_reason text, p_exempt boolean default null, p_exempt_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare l public.invoice_lines;
begin
  if not public.is_admin() then raise exception 'Only an administrator can fix invoice lines' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into l from public.invoice_lines where id = p_line_id for update;
  if not found then raise exception 'Line not found' using errcode = 'P0002'; end if;
  if p_amount_paise is not null and p_amount_paise < 0 then raise exception 'Amount cannot be negative' using errcode = '22023'; end if;
  update public.invoice_lines set
    original_amount_paise = coalesce(original_amount_paise, amount_paise),
    amount_paise = coalesce(p_amount_paise, amount_paise),
    discount_paise = case when p_amount_paise is not null then least(round(p_amount_paise::numeric * coalesce((calc_detail ->> 'discount_bp')::integer, 0) / 10000)::bigint, p_amount_paise) else discount_paise end,
    exempt = coalesce(p_exempt, exempt), exempt_reason = case when coalesce(p_exempt, exempt) then coalesce(p_exempt_reason, exempt_reason) else null end,
    fix_reason = p_reason, fixed_by = auth.uid(), fixed_at = now()
  where id = p_line_id;
  perform public.recalculate_invoice(l.invoice_id);
end;
$$;

create or replace function public.remove_invoice_line(p_line_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare l public.invoice_lines;
begin
  if not public.is_admin() then raise exception 'Only an administrator can remove invoice lines' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into l from public.invoice_lines where id = p_line_id for update;
  if not found then raise exception 'Line not found' using errcode = 'P0002'; end if;
  delete from public.invoice_lines where id = p_line_id;
  if l.doc_type = 'INWARD_RECEIPT' then update public.inward_receipts set billed_invoice_id = null where id = l.doc_id;
  elsif l.doc_type = 'DELIVERY_CHALLAN' then update public.delivery_challans set billed_invoice_id = null where id = l.doc_id; end if;
  if cardinality(l.allocation_ids) > 0 then update public.slot_allocations set min_days_invoice_id = null where id = any (l.allocation_ids); end if;
  perform public.recalculate_invoice(l.invoice_id);
end;
$$;

create or replace function public.add_other_charge(p_invoice_id uuid, p_charge_id uuid, p_description text, p_quantity numeric, p_amount_paise bigint,
                                                   p_reason text, p_sac_code text default null, p_gst_rate_bp integer default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare inv public.invoices; ch public.other_charges; t record; v_id uuid; v_amt bigint; v_sac text; v_rate integer; v_desc text; v_pct integer; v_base text;
begin
  if not public.is_admin() then raise exception 'Only an administrator can add charges' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or inv.status <> 'DRAFT' then raise exception 'Charges can only be added to a draft' using errcode = 'WMS25'; end if;
  select * into t from public.resolve_tax_rule('OTHER', null, inv.period_to);
  if p_charge_id is not null then
    select * into ch from public.other_charges where id = p_charge_id and deleted_at is null and is_active;
    if not found then raise exception 'Charge not found or inactive' using errcode = 'P0002'; end if;
    v_desc := coalesce(nullif(p_description, ''), ch.name);
    v_sac := coalesce(p_sac_code, ch.sac_code, t.sac_code); v_rate := coalesce(p_gst_rate_bp, ch.gst_rate_bp, t.gst_rate_bp);
    if ch.calc = 'PERCENT' then v_pct := ch.percent_bp; v_base := ch.percent_base; v_amt := 0;
    else v_amt := coalesce(p_amount_paise, round(ch.fixed_amount_paise * coalesce(p_quantity, 1))::bigint); end if;
  else
    if coalesce(trim(p_description), '') = '' or p_amount_paise is null then raise exception 'A manual charge needs a description and an amount' using errcode = '22023'; end if;
    v_desc := p_description; v_amt := p_amount_paise; v_sac := coalesce(p_sac_code, t.sac_code); v_rate := coalesce(p_gst_rate_bp, t.gst_rate_bp);
  end if;
  if v_sac is null or v_rate is null then raise exception 'No tax rule for other charges' using errcode = 'WMS23'; end if;
  insert into public.invoice_lines (invoice_id, section, line_no, description, quantity, unit, rate_paise, amount_paise, discount_paise, taxable_paise, sac_code,
      gst_rate_bp, charge_id, percent_bp, percent_base, manual, fix_reason, fixed_by, fixed_at)
  values (p_invoice_id, 'OTHER', (select coalesce(max(line_no), 0) + 1 from public.invoice_lines where invoice_id = p_invoice_id), v_desc,
      coalesce(p_quantity, 1), 'nos', v_amt, v_amt, 0, v_amt, v_sac, v_rate, p_charge_id, v_pct, v_base, true, p_reason, auth.uid(), now())
  returning id into v_id;
  perform public.recalculate_invoice(p_invoice_id);
  return v_id;
end;
$$;

-- Discarding a draft releases everything it reserved (documents, minimum-day top-ups, rent period).
create or replace function public.discard_draft_invoice(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare inv public.invoices;
begin
  if not public.is_admin() then raise exception 'Only an administrator can discard a draft' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'WMS08'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or inv.status <> 'DRAFT' then raise exception 'Only a draft can be discarded' using errcode = 'WMS25'; end if;
  update public.inward_receipts set billed_invoice_id = null where billed_invoice_id = p_invoice_id;
  update public.delivery_challans set billed_invoice_id = null where billed_invoice_id = p_invoice_id;
  update public.slot_allocations set min_days_invoice_id = null where min_days_invoice_id = p_invoice_id;
  update public.invoices set status = 'CANCELLED', cancel_reason = p_reason, rent_range = null where id = p_invoice_id;
end;
$$;

-- ---------- issue: locks the invoice forever, numbers it inside the same transaction ----------
create or replace function public.issue_invoice(p_invoice_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare inv public.invoices; c public.clients; v_no text; v_today date := public.today_ist(); sup jsonb;
begin
  if not public.is_admin() then raise exception 'Only an administrator can issue invoices' using errcode = '42501'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if inv.status <> 'DRAFT' then raise exception 'Invoice is already %', inv.status using errcode = 'WMS25'; end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then raise exception 'The invoice has no lines' using errcode = 'WMS20'; end if;
  perform public.recalculate_invoice(inv.id);
  select * into c from public.clients where id = inv.client_id;
  sup := coalesce(public.setting_json('supplier'), '{}'::jsonb);
  v_no := public.next_doc_number(inv.warehouse_id, 'INV');
  update public.invoices set invoice_no = v_no, status = 'ISSUED', invoice_date = v_today, due_date = v_today + c.payment_terms_days,
    issued_by = auth.uid(), issued_at = now(), supplier_snapshot = sup,
    client_snapshot = jsonb_build_object('name', c.company_name, 'gstin', c.gstin, 'pan', c.pan, 'state_code', c.state_code, 'state', c.state,
        'address', concat_ws(', ', c.address_line1, c.address_line2, c.city, c.district, c.state, c.pincode), 'email', c.email, 'phone', c.phone,
        'gst_exempt', c.gst_exempt)
  where id = inv.id;
  perform public.apply_advances(inv.client_id);
  return v_no;
end;
$$;

-- ---------- e-invoice JSON (IRP schema 1.1 shape). The government portal is NOT called. ----------
create or replace function public.einvoice_json(p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare i public.invoices; s jsonb; c jsonb; v_items jsonb; n integer := 0;
begin
  if not (public.is_admin() or public.is_accountant()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into i from public.invoices where id = p_invoice_id;
  if not found or i.status in ('DRAFT', 'CANCELLED') then raise exception 'Only issued invoices can be exported' using errcode = 'WMS25'; end if;
  s := i.supplier_snapshot; c := i.client_snapshot;
  select jsonb_agg(jsonb_build_object('SlNo', (row_number() over (order by t.section, t.sac_code, t.gst_rate_bp))::text, 'PrdDesc', initcap(lower(t.section::text)) || ' services',
         'IsServc', 'Y', 'HsnCd', t.sac_code, 'Qty', 1, 'Unit', 'OTH', 'UnitPrice', t.taxable_paise / 100.0, 'TotAmt', t.taxable_paise / 100.0, 'Discount', 0,
         'AssAmt', t.taxable_paise / 100.0, 'GstRt', t.gst_rate_bp / 100.0, 'IgstAmt', t.igst_paise / 100.0, 'CgstAmt', t.cgst_paise / 100.0, 'SgstAmt', t.sgst_paise / 100.0,
         'TotItemVal', (t.taxable_paise + t.cgst_paise + t.sgst_paise + t.igst_paise) / 100.0) order by t.section, t.sac_code, t.gst_rate_bp)
    into v_items from public.invoice_tax_lines t where t.invoice_id = i.id;
  return jsonb_build_object('Version', '1.1',
    'TranDtls', jsonb_build_object('TaxSch', 'GST', 'SupTyp', case when c ->> 'gstin' is null then 'B2C' else 'B2B' end, 'RegRev', 'N', 'IgstOnIntra', 'N'),
    'DocDtls', jsonb_build_object('Typ', 'INV', 'No', i.invoice_no, 'Dt', to_char(i.invoice_date, 'DD/MM/YYYY')),
    'SellerDtls', jsonb_build_object('Gstin', s ->> 'gstin', 'LglNm', coalesce(nullif(s ->> 'legal_name', ''), s ->> 'name'), 'Addr1', s ->> 'address', 'Loc', s ->> 'state_name', 'Stcd', s ->> 'state_code'),
    'BuyerDtls', jsonb_build_object('Gstin', coalesce(c ->> 'gstin', 'URP'), 'LglNm', c ->> 'name', 'Pos', i.place_of_supply, 'Addr1', c ->> 'address', 'Loc', c ->> 'state', 'Stcd', coalesce(c ->> 'state_code', i.place_of_supply)),
    'ItemList', coalesce(v_items, '[]'::jsonb),
    'ValDtls', jsonb_build_object('AssVal', i.taxable_paise / 100.0, 'CgstVal', i.cgst_paise / 100.0, 'SgstVal', i.sgst_paise / 100.0, 'IgstVal', i.igst_paise / 100.0,
                                  'RndOffAmt', i.round_off_paise / 100.0, 'TotInvVal', i.grand_total_paise / 100.0),
    'Irn', i.irn, 'QrCode', i.qr_code);
end;
$$;
