-- =====================================================================
-- Phase 3 masters: billing settings, tax rules, other charges, rate cards, rate resolvers.
-- Money is integer paise; percentages and multipliers are integer basis points (100 bp = 1 %, 10000 = 1.00x).
-- =====================================================================
create extension if not exists btree_gist;

-- ---------- role helpers ----------
create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_app_role() = 'ACCOUNTANT', false) $$;

create or replace function public.can_view_billing(p_warehouse_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin() or public.is_accountant() or public.manages_warehouse(p_warehouse_id) or public.is_my_client(p_client_id) $$;

-- accountants may look up clients and warehouses (read only)
create or replace function public.can_see_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.is_accountant()
      or public.current_app_role() = 'WAREHOUSE_MANAGER'
      or public.is_my_client(p_client_id)
      or exists (select 1 from public.contracts c
                 where c.client_id = p_client_id and c.deleted_at is null and public.can_read_warehouse(c.warehouse_id))
$$;
create policy warehouses_select_accountant on public.warehouses for select to authenticated using (public.is_accountant());

-- ---------- settings (all tunables live here, never in code) ----------
insert into public.app_settings (key, value, description) values
 ('supplier', jsonb_build_object('name','','legal_name','','gstin','','pan','','state_code','33','state_name','Tamil Nadu',
     'address','','phone','','email','','bank_name','','bank_account','','bank_ifsc','','bank_branch','','upi_id',''),
  'Supplier details printed on every invoice. Fill in before the first invoice.'),
 ('invoice_terms', to_jsonb('Payment is due by the due date shown. Goods are stored at the owner''s risk unless insured separately.'::text), 'Terms printed on invoices'),
 ('day_count_rule', '{"include_start":true,"include_end":false,"part_day_counts":true}', 'How storage days are counted: start day included, end day excluded; a Brigade held part of a day counts that day'),
 ('billing_block', '{"enabled":false,"overdue_days":30,"block_over_credit_limit":true}', 'Block new bookings and dispatch requests for clients over their credit limit or overdue beyond N days'),
 ('razorpay', '{"enabled":false}', 'Feature flag for Razorpay payment links'),
 ('email', '{"enabled":false,"from":""}', 'Feature flag for sending invoice emails'),
 ('reminders', '{"enabled":true,"days_after_due":[1,7,15]}', 'Days after the due date on which overdue reminders are queued')
on conflict (key) do nothing;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
  using (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT')
         or (public.current_app_role() = 'CLIENT' and key in ('supplier', 'invoice_terms')));

create or replace function public.setting_json(p_key text)
returns jsonb language sql stable security definer set search_path = ''
as $$ select value from public.app_settings where key = p_key $$;

-- ---------- groups and client billing fields ----------
create table public.client_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
alter table public.clients
  add column group_id uuid references public.client_groups(id),
  add column billing_cycle public.billing_cycle not null default 'MONTHLY',
  add column billing_mode  public.billing_mode  not null default 'BOTH',
  add column payment_terms_days integer not null default 15 check (payment_terms_days >= 0),
  add column gst_exempt boolean not null default false,
  add column gst_exempt_reason text,
  add column billing_override_until date,
  add column billing_override_reason text,
  add constraint clients_exempt_reason check (not gst_exempt or coalesce(trim(gst_exempt_reason), '') <> '');
create index clients_group_idx on public.clients (group_id);

-- ---------- tax rules (SAC and GST rate per section) ----------
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  section public.invoice_section not null,
  storage_type public.storage_type,                 -- RENT only: null = any storage type
  sac_code text not null check (sac_code ~ '^[0-9]{4,8}$'),
  gst_rate_bp integer not null check (gst_rate_bp between 0 and 10000),
  description text,
  valid_from date not null default date '2017-07-01',
  valid_to date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint tax_rules_dates check (valid_to is null or valid_to >= valid_from)
);
-- SUGGESTED DEFAULTS, to be confirmed by the accountant (editable in the app)
insert into public.tax_rules (section, storage_type, sac_code, gst_rate_bp, description) values
 ('RENT', 'CHILLED',     '996721', 1800, 'Refrigerated storage'),
 ('RENT', 'FROZEN',      '996721', 1800, 'Refrigerated storage'),
 ('RENT', 'DEEP_FREEZE', '996721', 1800, 'Refrigerated storage'),
 ('RENT', null,          '996729', 1800, 'Other storage and warehousing'),
 ('LABOUR', null,        '996719', 1800, 'Other cargo handling'),
 ('OTHER', null,         '996729', 1800, 'Other charges');

create or replace function public.resolve_tax_rule(p_section public.invoice_section, p_storage_type public.storage_type, p_date date)
returns table (sac_code text, gst_rate_bp integer)
language sql stable security definer set search_path = ''
as $$
  select t.sac_code, t.gst_rate_bp from public.tax_rules t
  where t.section = p_section and (t.storage_type is null or t.storage_type = p_storage_type)
    and p_date >= t.valid_from and (t.valid_to is null or p_date <= t.valid_to)
  order by (t.storage_type is not null) desc, t.valid_from desc limit 1
$$;

-- ---------- other charges master ----------
create table public.other_charges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,30}$'),
  name text not null,
  calc public.charge_calc not null default 'FIXED',
  fixed_amount_paise bigint not null default 0 check (fixed_amount_paise >= 0),
  percent_bp integer not null default 0 check (percent_bp between 0 and 100000),
  percent_base text not null default 'RENT_LABOUR' check (percent_base in ('RENT', 'LABOUR', 'RENT_LABOUR')),
  sac_code text check (sac_code is null or sac_code ~ '^[0-9]{4,8}$'),
  gst_rate_bp integer check (gst_rate_bp is null or gst_rate_bp between 0 and 10000),   -- null = use the OTHER tax rule
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
insert into public.other_charges (code, name, calc, is_active) values
 ('POWER_DEEP_FREEZE', 'Power surcharge (deep freeze)', 'FIXED', false),
 ('BLAST_FREEZING',    'Blast freezing',                'FIXED', false),
 ('INSURANCE',         'Insurance',                     'PERCENT', false),
 ('PACKING_MATERIAL',  'Packaging material',            'FIXED', false),
 ('LATE_PICKUP',       'Late pickup penalty',           'FIXED', false);

-- ---------- rate cards ----------
create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  scope public.rate_scope not null,
  client_id uuid references public.clients(id),
  group_id uuid references public.client_groups(id),
  warehouse_id uuid references public.warehouses(id),
  valid_from date not null default current_date,
  valid_to date,
  rent_discount_bp integer not null default 0 check (rent_discount_bp between 0 and 10000),
  labour_discount_bp integer not null default 0 check (labour_discount_bp between 0 and 10000),
  free_days integer not null default 0 check (free_days >= 0),
  min_billing_days integer not null default 0 check (min_billing_days >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint rate_cards_dates check (valid_to is null or valid_to >= valid_from),
  constraint rate_cards_scope_keys check (
    (scope = 'CLIENT'    and client_id is not null and group_id is null) or
    (scope = 'GROUP'     and group_id  is not null and client_id is null) or
    (scope = 'WAREHOUSE' and warehouse_id is not null and client_id is null and group_id is null) or
    (scope = 'GLOBAL'    and client_id is null and group_id is null and warehouse_id is null))
);
create index rate_cards_client_idx on public.rate_cards (client_id);
create index rate_cards_group_idx on public.rate_cards (group_id);
create index rate_cards_warehouse_idx on public.rate_cards (warehouse_id);

create table public.rent_rates (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references public.rate_cards(id),
  storage_type public.storage_type not null,
  temp_min numeric(5,2), temp_max numeric(5,2),
  brigade_type_id uuid references public.brigade_types(id),
  basis public.rent_basis not null default 'PER_BRIGADE',
  rate_paise bigint not null check (rate_paise >= 0),          -- per brigade per day, or per m3 per day
  tier_from integer, tier_to integer,                          -- volume tier by Brigades held that day
  valid_from date not null, valid_to date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint rent_rates_band check ((temp_min is null) = (temp_max is null) and (temp_min is null or temp_min <= temp_max)),
  constraint rent_rates_tier check ((tier_from is null and tier_to is null) or (tier_from >= 1 and (tier_to is null or tier_to >= tier_from))),
  constraint rent_rates_dates check (valid_to is null or valid_to >= valid_from)
);
create index rent_rates_card_idx on public.rent_rates (rate_card_id);

create table public.labour_rates (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references public.rate_cards(id),
  activity public.labour_activity not null,
  basis public.labour_basis not null,
  rate_paise bigint not null check (rate_paise >= 0),
  cold_premium_type public.premium_type not null default 'NONE',
  cold_premium_value bigint not null default 0 check (cold_premium_value >= 0),   -- bp if PERCENT, paise per unit if AMOUNT
  night_multiplier_bp integer not null default 10000 check (night_multiplier_bp >= 0),
  overtime_multiplier_bp integer not null default 10000 check (overtime_multiplier_bp >= 0),
  valid_from date not null, valid_to date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint labour_rates_dates check (valid_to is null or valid_to >= valid_from)
);
create index labour_rates_card_idx on public.labour_rates (rate_card_id);

-- A rate used on any invoice line can never be edited or removed: close it (valid_to) and create a new one.
create or replace function public.rates_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_used boolean;
begin
  execute 'select exists (select 1 from public.invoice_lines where rate_ids @> array[$1])' into v_used using old.id;
  if v_used then
    if (to_jsonb(new) - 'valid_to' - 'updated_at') is distinct from (to_jsonb(old) - 'valid_to' - 'updated_at') then
      raise exception 'This rate is already used on an invoice; close it with a valid-to date and create a new rate' using errcode = 'WMS21';
    end if;
    if new.valid_to is null or new.valid_to < old.valid_from or (old.valid_to is not null and new.valid_to > old.valid_to) then
      raise exception 'A used rate can only be closed earlier, not extended' using errcode = 'WMS21';
    end if;
  end if;
  return new;
end;
$$;
create trigger rent_rates_guard   before update on public.rent_rates   for each row execute function public.rates_guard();
create trigger labour_rates_guard before update on public.labour_rates for each row execute function public.rates_guard();

-- ---------- resolvers: ONE function per family, used everywhere ----------
-- Scope order: CLIENT, then GROUP, then WAREHOUSE default, then GLOBAL default. First match valid on the date wins.
create or replace function public.rent_rate_candidates(
  p_client_id uuid, p_warehouse_id uuid, p_storage_type public.storage_type, p_temp_min numeric, p_temp_max numeric,
  p_brigade_type_id uuid, p_date date, p_brigades integer default 1)
returns table (rank integer, rent_rate_id uuid, rate_card_id uuid, card_name text, scope public.rate_scope,
               basis public.rent_basis, rate_paise bigint, tier_from integer, tier_to integer, source text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not (public.is_admin() or public.is_accountant()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select (row_number() over (order by x.sr, x.spec desc, x.valid_from desc, x.id))::integer, x.id, x.card_id, x.card_name, x.scope,
         x.basis, x.rate_paise, x.tier_from, x.tier_to,
         format('%s rate card "%s" · %s%s · %s paise/%s%s · valid %s to %s', initcap(x.scope::text), x.card_name, x.storage_type,
                case when x.temp_min is not null then format(' %s..%s C', x.temp_min, x.temp_max) else '' end,
                x.rate_paise, case x.basis when 'PER_M3' then 'm3/day' else 'brigade/day' end,
                case when x.tier_from is not null then format(' · tier %s-%s', x.tier_from, coalesce(x.tier_to::text, 'up')) else '' end,
                x.valid_from, coalesce(x.valid_to::text, 'open'))
  from (
    select rr.id, rc.id as card_id, rc.name as card_name, rc.scope, rr.basis, rr.rate_paise, rr.tier_from, rr.tier_to,
           rr.storage_type, rr.temp_min, rr.temp_max, rr.valid_from, rr.valid_to,
           case rc.scope when 'CLIENT' then 1 when 'GROUP' then 2 when 'WAREHOUSE' then 3 else 4 end as sr,
           (rr.temp_min is not null)::int + (rr.brigade_type_id is not null)::int + (rr.tier_from is not null)::int as spec
    from public.rent_rates rr
    join public.rate_cards rc on rc.id = rr.rate_card_id
    where rc.is_active and rc.deleted_at is null and rr.deleted_at is null
      and p_date >= rc.valid_from and (rc.valid_to is null or p_date <= rc.valid_to)
      and p_date >= rr.valid_from and (rr.valid_to is null or p_date <= rr.valid_to)
      and ((rc.scope = 'CLIENT' and rc.client_id = p_client_id)
        or (rc.scope = 'GROUP' and rc.group_id = (select cl.group_id from public.clients cl where cl.id = p_client_id))
        or (rc.scope = 'WAREHOUSE' and rc.warehouse_id = p_warehouse_id)
        or rc.scope = 'GLOBAL')
      and (rc.warehouse_id is null or rc.warehouse_id = p_warehouse_id)
      and rr.storage_type = p_storage_type
      and (rr.temp_min is null or (p_temp_min is not null and p_temp_max is not null and rr.temp_min <= p_temp_min and p_temp_max <= rr.temp_max))
      and (rr.brigade_type_id is null or rr.brigade_type_id = p_brigade_type_id)
      and (rr.tier_from is null or (p_brigades >= rr.tier_from and (rr.tier_to is null or p_brigades <= rr.tier_to)))
  ) x order by 1;
end;
$$;

create or replace function public.resolve_rent_rate(
  p_client_id uuid, p_warehouse_id uuid, p_storage_type public.storage_type, p_temp_min numeric, p_temp_max numeric,
  p_brigade_type_id uuid, p_date date, p_brigades integer default 1)
returns table (rent_rate_id uuid, rate_card_id uuid, scope public.rate_scope, basis public.rent_basis, rate_paise bigint, source text)
language sql stable security definer set search_path = ''
as $$
  select c.rent_rate_id, c.rate_card_id, c.scope, c.basis, c.rate_paise, c.source
  from public.rent_rate_candidates(p_client_id, p_warehouse_id, p_storage_type, p_temp_min, p_temp_max, p_brigade_type_id, p_date, p_brigades) c
  where c.rank = 1
$$;

create or replace function public.labour_rate_candidates(p_client_id uuid, p_warehouse_id uuid, p_activity public.labour_activity, p_date date)
returns table (rank integer, labour_rate_id uuid, rate_card_id uuid, card_name text, scope public.rate_scope, basis public.labour_basis,
               rate_paise bigint, cold_premium_type public.premium_type, cold_premium_value bigint,
               night_multiplier_bp integer, overtime_multiplier_bp integer, source text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not (public.is_admin() or public.is_accountant()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select (row_number() over (order by x.sr, x.valid_from desc, x.id))::integer, x.id, x.card_id, x.card_name, x.scope, x.basis, x.rate_paise,
         x.cold_premium_type, x.cold_premium_value, x.night_multiplier_bp, x.overtime_multiplier_bp,
         format('%s rate card "%s" · %s %s · %s paise · valid %s to %s', initcap(x.scope::text), x.card_name, x.activity, x.basis,
                x.rate_paise, x.valid_from, coalesce(x.valid_to::text, 'open'))
  from (
    select lr.id, rc.id as card_id, rc.name as card_name, rc.scope, lr.activity, lr.basis, lr.rate_paise, lr.cold_premium_type, lr.cold_premium_value,
           lr.night_multiplier_bp, lr.overtime_multiplier_bp, lr.valid_from, lr.valid_to,
           case rc.scope when 'CLIENT' then 1 when 'GROUP' then 2 when 'WAREHOUSE' then 3 else 4 end as sr
    from public.labour_rates lr
    join public.rate_cards rc on rc.id = lr.rate_card_id
    where rc.is_active and rc.deleted_at is null and lr.deleted_at is null and lr.activity = p_activity
      and p_date >= rc.valid_from and (rc.valid_to is null or p_date <= rc.valid_to)
      and p_date >= lr.valid_from and (lr.valid_to is null or p_date <= lr.valid_to)
      and ((rc.scope = 'CLIENT' and rc.client_id = p_client_id)
        or (rc.scope = 'GROUP' and rc.group_id = (select cl.group_id from public.clients cl where cl.id = p_client_id))
        or (rc.scope = 'WAREHOUSE' and rc.warehouse_id = p_warehouse_id)
        or rc.scope = 'GLOBAL')
      and (rc.warehouse_id is null or rc.warehouse_id = p_warehouse_id)
  ) x order by 1;
end;
$$;

create or replace function public.resolve_labour_rate(p_client_id uuid, p_warehouse_id uuid, p_activity public.labour_activity, p_date date)
returns table (labour_rate_id uuid, rate_card_id uuid, scope public.rate_scope, basis public.labour_basis, rate_paise bigint,
               cold_premium_type public.premium_type, cold_premium_value bigint, night_multiplier_bp integer, overtime_multiplier_bp integer, source text)
language sql stable security definer set search_path = ''
as $$
  select c.labour_rate_id, c.rate_card_id, c.scope, c.basis, c.rate_paise, c.cold_premium_type, c.cold_premium_value,
         c.night_multiplier_bp, c.overtime_multiplier_bp, c.source
  from public.labour_rate_candidates(p_client_id, p_warehouse_id, p_activity, p_date) c where c.rank = 1
$$;

-- Discount %, free days and minimum billing days come from the first matching rate card (same scope order).
create or replace function public.resolve_rate_terms(p_client_id uuid, p_warehouse_id uuid, p_date date)
returns table (rate_card_id uuid, scope public.rate_scope, rent_discount_bp integer, labour_discount_bp integer, free_days integer, min_billing_days integer)
language sql stable security definer set search_path = ''
as $$
  select rc.id, rc.scope, rc.rent_discount_bp, rc.labour_discount_bp, rc.free_days, rc.min_billing_days
  from public.rate_cards rc
  where rc.is_active and rc.deleted_at is null and p_date >= rc.valid_from and (rc.valid_to is null or p_date <= rc.valid_to)
    and ((rc.scope = 'CLIENT' and rc.client_id = p_client_id)
      or (rc.scope = 'GROUP' and rc.group_id = (select cl.group_id from public.clients cl where cl.id = p_client_id))
      or (rc.scope = 'WAREHOUSE' and rc.warehouse_id = p_warehouse_id)
      or rc.scope = 'GLOBAL')
    and (rc.warehouse_id is null or rc.warehouse_id = p_warehouse_id)
  order by case rc.scope when 'CLIENT' then 1 when 'GROUP' then 2 when 'WAREHOUSE' then 3 else 4 end, rc.valid_from desc, rc.id
  limit 1
$$;

-- What a client sees of its own rates (effective today, best scope per key)
create or replace function public.my_rate_summary()
returns table (kind text, label text, basis text, rate_paise bigint, scope text, detail text)
language sql stable security definer set search_path = ''
as $$
  with me as (select public.current_client_id() as id),
  rent as (
    select distinct on (rr.storage_type, rr.temp_min, rr.temp_max, rr.brigade_type_id, rr.tier_from, rr.tier_to)
           'RENT'::text k, rr.storage_type::text || coalesce(format(' %s..%s C', rr.temp_min, rr.temp_max), '') as lbl, rr.basis::text b, rr.rate_paise, rc.scope::text s,
           coalesce(format('tier %s-%s brigades', rr.tier_from, coalesce(rr.tier_to::text, 'up')), '') d
    from public.rent_rates rr join public.rate_cards rc on rc.id = rr.rate_card_id, me
    where me.id is not null and rc.is_active and rc.deleted_at is null and rr.deleted_at is null
      and current_date >= rc.valid_from and (rc.valid_to is null or current_date <= rc.valid_to)
      and current_date >= rr.valid_from and (rr.valid_to is null or current_date <= rr.valid_to)
      and (rc.scope = 'GLOBAL' or (rc.scope = 'CLIENT' and rc.client_id = me.id)
           or (rc.scope = 'GROUP' and rc.group_id = (select group_id from public.clients where id = me.id))
           or rc.scope = 'WAREHOUSE')
    order by rr.storage_type, rr.temp_min, rr.temp_max, rr.brigade_type_id, rr.tier_from, rr.tier_to,
             case rc.scope when 'CLIENT' then 1 when 'GROUP' then 2 when 'WAREHOUSE' then 3 else 4 end),
  lab as (
    select distinct on (lr.activity) 'LABOUR'::text k, lr.activity::text lbl, lr.basis::text b, lr.rate_paise, rc.scope::text s,
           case when lr.cold_premium_type <> 'NONE' then 'cold-room premium applies' else '' end d
    from public.labour_rates lr join public.rate_cards rc on rc.id = lr.rate_card_id, me
    where me.id is not null and rc.is_active and rc.deleted_at is null and lr.deleted_at is null
      and current_date >= rc.valid_from and (rc.valid_to is null or current_date <= rc.valid_to)
      and current_date >= lr.valid_from and (lr.valid_to is null or current_date <= lr.valid_to)
      and (rc.scope = 'GLOBAL' or (rc.scope = 'CLIENT' and rc.client_id = me.id)
           or (rc.scope = 'GROUP' and rc.group_id = (select group_id from public.clients where id = me.id))
           or rc.scope = 'WAREHOUSE')
    order by lr.activity, case rc.scope when 'CLIENT' then 1 when 'GROUP' then 2 when 'WAREHOUSE' then 3 else 4 end)
  select * from rent union all select * from lab
$$;

-- ---------- RLS ----------
alter table public.client_groups enable row level security;
alter table public.tax_rules     enable row level security;
alter table public.other_charges enable row level security;
alter table public.rate_cards    enable row level security;
alter table public.rent_rates    enable row level security;
alter table public.labour_rates  enable row level security;

create policy client_groups_select on public.client_groups for select to authenticated
  using (public.is_admin() or public.is_accountant() or public.current_app_role() = 'WAREHOUSE_MANAGER');
create policy client_groups_write on public.client_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['tax_rules', 'other_charges', 'rate_cards', 'rent_rates', 'labour_rates'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_admin() or public.is_accountant())', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_admin())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
create trigger set_updated_at before update on public.client_groups for each row execute function public.set_updated_at();

insert into public.doc_types (code, prefix, name) values
  ('INV', 'IN', 'Tax invoice'), ('CN', 'CN', 'Credit note'), ('DN', 'DN', 'Debit note'), ('PAY', 'PY', 'Payment receipt')
on conflict (code) do nothing;
