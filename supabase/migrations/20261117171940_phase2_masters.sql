-- =====================================================================
-- Phase 2 masters: GST states, settings, document numbering, clients,
-- client logins, contracts, sender/receiver companies, client-aware RLS helpers.
-- =====================================================================

-- ---------- Reference data ----------
create table public.gst_states (
  code  text primary key check (code ~ '^[0-9]{2}$'),
  name  text not null
);
insert into public.gst_states (code, name) values
  ('01','Jammu and Kashmir'),('02','Himachal Pradesh'),('03','Punjab'),('04','Chandigarh'),
  ('05','Uttarakhand'),('06','Haryana'),('07','Delhi'),('08','Rajasthan'),('09','Uttar Pradesh'),
  ('10','Bihar'),('11','Sikkim'),('12','Arunachal Pradesh'),('13','Nagaland'),('14','Manipur'),
  ('15','Mizoram'),('16','Tripura'),('17','Meghalaya'),('18','Assam'),('19','West Bengal'),
  ('20','Jharkhand'),('21','Odisha'),('22','Chhattisgarh'),('23','Madhya Pradesh'),('24','Gujarat'),
  ('25','Daman and Diu'),('26','Dadra and Nagar Haveli and Daman and Diu'),('27','Maharashtra'),
  ('28','Andhra Pradesh (before division)'),('29','Karnataka'),('30','Goa'),('31','Lakshadweep'),
  ('32','Kerala'),('33','Tamil Nadu'),('34','Puducherry'),('35','Andaman and Nicobar Islands'),
  ('36','Telangana'),('37','Andhra Pradesh'),('38','Ladakh'),('97','Other Territory'),
  ('99','Centre Jurisdiction');

-- Tunables live in a table, not in code.
create table public.app_settings (
  key          text primary key,
  value        jsonb not null,
  description  text,
  updated_at   timestamptz not null default now()
);
insert into public.app_settings (key, value, description) values
  ('expiry_alert_days', '30', 'Default look-ahead in days for stock expiry alerts');

-- Document types and their number prefixes (editable by admin).
-- A number is  <prefix>/<warehouse code>/<financial year>/<4-digit serial>  and must fit in 16
-- characters, so with 2-letter prefixes warehouse codes of up to 3 characters (W1 ... W99) work.
create table public.doc_types (
  code    text primary key,
  prefix  text not null check (prefix ~ '^[A-Z]{1,4}$'),
  name    text not null
);
insert into public.doc_types (code, prefix, name) values
  ('GRN', 'GR',  'Inward receipt (goods received note)'),
  ('DC',  'DC',  'Delivery challan'),
  ('GP',  'GP',  'Gate pass'),
  ('DR',  'DR',  'Dispatch request'),
  ('BK',  'BK',  'Space booking');

-- ---------- Small pure helpers ----------
create or replace function public.today_ist()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- Indian financial year (April-March) as 4 digits, e.g. 2026-11-17 -> '2627'
create or replace function public.financial_year_label(p_date date)
returns text language sql immutable set search_path = ''
as $$
  select lpad((y % 100)::text, 2, '0') || lpad(((y + 1) % 100)::text, 2, '0')
  from (select case when extract(month from p_date) >= 4 then extract(year from p_date)::int
                    else extract(year from p_date)::int - 1 end as y) t
$$;

-- GSTIN: 2-digit state + 10-char PAN + entity + 'Z' + mod-36 check character.
create or replace function public.is_valid_gstin(p text)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  chars constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  s int := 0; v int; prod int; i int;
begin
  if p is null or p !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    return false;
  end if;
  for i in 1..14 loop
    v := strpos(chars, substr(p, i, 1)) - 1;
    prod := v * (case when i % 2 = 1 then 1 else 2 end);
    s := s + (prod / 36) + (prod % 36);
  end loop;
  return substr(chars, ((36 - (s % 36)) % 36) + 1, 1) = substr(p, 15, 1);
end;
$$;

-- ---------- Document numbering ----------
-- One locked counter row per warehouse / document type / financial year.
-- The counter is incremented inside the caller's transaction, so a rolled-back
-- document never consumes a number and concurrent callers queue on the row lock.
create table public.doc_counters (
  warehouse_id  uuid not null references public.warehouses(id),
  doc_type      text not null references public.doc_types(code),
  fin_year      text not null check (fin_year ~ '^[0-9]{4}$'),
  last_no       integer not null default 0 check (last_no >= 0),
  updated_at    timestamptz not null default now(),
  primary key (warehouse_id, doc_type, fin_year)
);

create or replace function public.next_doc_number(p_warehouse_id uuid, p_doc_type text, p_date date default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fy     text := public.financial_year_label(coalesce(p_date, public.today_ist()));
  v_prefix text;
  v_wh     text;
  v_no     integer;
  v_out    text;
begin
  select prefix into v_prefix from public.doc_types where code = p_doc_type;
  if v_prefix is null then
    raise exception 'Unknown document type %', p_doc_type using errcode = 'P0002';
  end if;
  select code into v_wh from public.warehouses where id = p_warehouse_id;
  if v_wh is null then
    raise exception 'Warehouse not found' using errcode = 'P0002';
  end if;

  insert into public.doc_counters (warehouse_id, doc_type, fin_year, last_no)
  values (p_warehouse_id, p_doc_type, v_fy, 1)
  on conflict (warehouse_id, doc_type, fin_year)
  do update set last_no = public.doc_counters.last_no + 1, updated_at = now()
  returning last_no into v_no;

  v_out := v_prefix || '/' || v_wh || '/' || v_fy || '/' || lpad(v_no::text, 4, '0');
  if length(v_out) > 16 then
    raise exception 'Document number % is longer than 16 characters; shorten the warehouse code or prefix', v_out
      using errcode = 'WMS10';
  end if;
  return v_out;
end;
$$;

-- Generic BEFORE INSERT trigger: fills the number column named in TG_ARGV[1]
-- with the next number of document type TG_ARGV[0].
create or replace function public.assign_doc_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_col text := tg_argv[1];
begin
  if (to_jsonb(new) ->> v_col) is null then
    new := jsonb_populate_record(new, jsonb_build_object(v_col, public.next_doc_number(new.warehouse_id, tg_argv[0])));
  end if;
  return new;
end;
$$;

-- ---------- clients ----------
create sequence public.client_code_seq;

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique
                       default ('C' || lpad(nextval('public.client_code_seq')::text, 3, '0'))
                       check (code ~ '^[A-Z0-9]{1,10}$'),
  company_name       text not null check (length(trim(company_name)) > 0),
  gstin              text check (gstin is null or public.is_valid_gstin(gstin)),
  pan                text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  address_line1      text,
  address_line2      text,
  city               text,
  district           text,
  state              text,
  state_code         text references public.gst_states(code),
  pincode            text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  contact_name       text,
  phone              text,
  email              text,
  credit_limit_paise bigint not null default 0 check (credit_limit_paise >= 0),
  pick_rule          public.pick_rule not null default 'FEFO',
  status             public.client_status not null default 'ACTIVE',
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint clients_gstin_pan check (gstin is null or pan is null or substr(gstin, 3, 10) = pan),
  constraint clients_gstin_state check (gstin is null or state_code = substr(gstin, 1, 2))
);
alter sequence public.client_code_seq owned by public.clients.code;
create unique index clients_gstin_uq on public.clients (gstin) where gstin is not null and deleted_at is null;

-- Upper-cases GSTIN/PAN and derives state code, state name and PAN from the GSTIN.
create or replace function public.normalise_gst_party()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.gstin := nullif(upper(trim(new.gstin)), '');
  new.pan := nullif(upper(trim(new.pan)), '');
  if new.gstin is not null then
    new.state_code := substr(new.gstin, 1, 2);
    new.pan := coalesce(new.pan, substr(new.gstin, 3, 10));
  end if;
  if new.state_code is not null and coalesce(trim(new.state), '') = '' then
    select g.name into new.state from public.gst_states g where g.code = new.state_code;
  end if;
  return new;
end;
$$;
create trigger normalise_gst_party before insert or update on public.clients
  for each row execute function public.normalise_gst_party();

-- ---------- client logins: profiles.client_id ----------
alter table public.profiles add column client_id uuid references public.clients(id);
alter table public.profiles add constraint profiles_client_only_for_client_role
  check (client_id is null or role = 'CLIENT');
create index profiles_client_idx on public.profiles (client_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, warehouse_id, client_id, must_change_password, created_by)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'CLIENT'),
    nullif(new.raw_app_meta_data ->> 'warehouse_id', '')::uuid,
    nullif(new.raw_app_meta_data ->> 'client_id', '')::uuid,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false),
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  );
  return new;
end;
$$;

create or replace function public.handle_user_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  o jsonb := coalesce(old.raw_app_meta_data, '{}'::jsonb);
begin
  if (n -> 'role') is distinct from (o -> 'role')
     or (n -> 'warehouse_id') is distinct from (o -> 'warehouse_id')
     or (n -> 'client_id') is distinct from (o -> 'client_id')
     or (n -> 'must_change_password') is distinct from (o -> 'must_change_password')
     or (n -> 'created_by') is distinct from (o -> 'created_by') then
    update public.profiles p set
      role = case when (n -> 'role') is distinct from (o -> 'role') and n ? 'role'
                  then (n ->> 'role')::public.app_role else p.role end,
      warehouse_id = case when (n -> 'warehouse_id') is distinct from (o -> 'warehouse_id')
                          then nullif(n ->> 'warehouse_id', '')::uuid else p.warehouse_id end,
      client_id = case when (n -> 'client_id') is distinct from (o -> 'client_id')
                       then nullif(n ->> 'client_id', '')::uuid else p.client_id end,
      must_change_password = case when (n -> 'must_change_password') is distinct from (o -> 'must_change_password')
                                  then coalesce((n ->> 'must_change_password')::boolean, false)
                                  else p.must_change_password end,
      created_by = case when (n -> 'created_by') is distinct from (o -> 'created_by')
                        then nullif(n ->> 'created_by', '')::uuid else p.created_by end
    where p.id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.warehouse_id is distinct from old.warehouse_id
     or new.client_id is distinct from old.client_id
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Not allowed to change protected profile fields' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    if not (old.role = 'STAFF' and old.id <> auth.uid() and public.manages_warehouse(old.warehouse_id)) then
      raise exception 'Not allowed to change account status' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------- contracts ----------
create table public.contracts (
  id                      uuid primary key default gen_random_uuid(),
  contract_no             text,
  client_id               uuid not null references public.clients(id),
  warehouse_id            uuid not null references public.warehouses(id),
  start_date              date not null,
  end_date                date,
  min_days                integer not null default 0 check (min_days >= 0),
  committed_brigades      integer not null default 0 check (committed_brigades >= 0),
  security_deposit_paise  bigint not null default 0 check (security_deposit_paise >= 0),
  notice_period_days      integer not null default 30 check (notice_period_days >= 0),
  status                  public.contract_status not null default 'DRAFT',
  -- EXTENSION POINT (Phase 3): rate cards. No FK yet because the table does not exist.
  rate_card_id            uuid,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint contracts_dates check (end_date is null or end_date >= start_date)
);
create unique index contracts_no_uq on public.contracts (contract_no) where contract_no is not null and deleted_at is null;

-- ---------- company_master: sender / receiver companies per client ----------
create table public.company_master (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id),
  kind           public.company_kind not null default 'BOTH',
  name           text not null check (length(trim(name)) > 0),
  gstin          text check (gstin is null or public.is_valid_gstin(gstin)),
  pan            text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  address_line1  text,
  address_line2  text,
  city           text,
  district       text,
  state          text,
  state_code     text references public.gst_states(code),
  pincode        text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  contact_name   text,
  phone          text,
  email          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint company_gstin_state check (gstin is null or state_code = substr(gstin, 1, 2))
);
create trigger normalise_gst_party before insert or update on public.company_master
  for each row execute function public.normalise_gst_party();

-- ---------- Client-aware helpers ----------
create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.client_id from public.profiles p
  where p.id = auth.uid() and p.role = 'CLIENT' and p.is_active and p.deleted_at is null
$$;

create or replace function public.is_my_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_client_id is not null and p_client_id = public.current_client_id() $$;

-- staff now operate (gate, receipts, picking) in their warehouse; same set as can_read_warehouse
create or replace function public.can_operate_warehouse(p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin() or public.manages_warehouse(p_warehouse_id) or public.is_staff_of(p_warehouse_id) $$;

create or replace function public.client_has_active_contract(p_client_id uuid, p_warehouse_id uuid, p_on date default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    join public.clients cl on cl.id = c.client_id
    where c.client_id = p_client_id and c.warehouse_id = p_warehouse_id and c.deleted_at is null
      and c.status = 'ACTIVE' and cl.status = 'ACTIVE' and cl.deleted_at is null
      and c.start_date <= coalesce(p_on, public.today_ist())
      and (c.end_date is null or c.end_date >= coalesce(p_on, public.today_ist()))
  )
$$;

-- a client login may see warehouses it has any (non-deleted) contract with
create or replace function public.client_sees_warehouse(p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.client_id = public.current_client_id() and c.warehouse_id = p_warehouse_id and c.deleted_at is null
  )
$$;

-- admins and managers see every client (managers onboard them); staff see clients
-- contracted to their warehouse; a client login sees itself.
create or replace function public.can_see_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or public.current_app_role() = 'WAREHOUSE_MANAGER'
      or public.is_my_client(p_client_id)
      or exists (
           select 1 from public.contracts c
           where c.client_id = p_client_id and c.deleted_at is null and public.can_read_warehouse(c.warehouse_id)
         )
$$;

-- used by invoker guard triggers, which cannot see every company through RLS
create or replace function public.company_belongs_to_client(p_company_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.company_master c
                 where c.id = p_company_id and c.client_id = p_client_id and c.deleted_at is null)
$$;

-- warehouse operators of the row's warehouse, or the owning client
create or replace function public.can_view_row(p_warehouse_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.can_read_warehouse(p_warehouse_id) or public.is_my_client(p_client_id) $$;

-- ---------- RLS ----------
alter table public.gst_states      enable row level security;
alter table public.app_settings    enable row level security;
alter table public.doc_types       enable row level security;
alter table public.doc_counters    enable row level security;
alter table public.clients         enable row level security;
alter table public.contracts       enable row level security;
alter table public.company_master  enable row level security;

create policy gst_states_select on public.gst_states for select to authenticated using (true);

create policy app_settings_select on public.app_settings for select to authenticated
  using (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'));
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy doc_types_select on public.doc_types for select to authenticated
  using (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'));
create policy doc_types_update on public.doc_types for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy doc_counters_select on public.doc_counters for select to authenticated using (public.is_admin());

create policy clients_select on public.clients for select to authenticated using (public.can_see_client(id));
create policy clients_insert on public.clients for insert to authenticated
  with check (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER'));
create policy clients_update on public.clients for update to authenticated
  using (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER'))
  with check (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER'));
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

create policy contracts_select on public.contracts for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id));
create policy contracts_update on public.contracts for update to authenticated
  using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy contracts_delete on public.contracts for delete to authenticated using (public.is_admin());

create policy company_master_select on public.company_master for select to authenticated
  using (public.can_see_client(client_id));
create policy company_master_insert on public.company_master for insert to authenticated
  with check (
    public.is_my_client(client_id)
    or (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF') and public.can_see_client(client_id))
  );
create policy company_master_update on public.company_master for update to authenticated
  using (
    public.is_my_client(client_id)
    or (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF') and public.can_see_client(client_id))
  )
  with check (
    public.is_my_client(client_id)
    or (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF') and public.can_see_client(client_id))
  );
create policy company_master_delete on public.company_master for delete to authenticated using (public.is_admin());

-- clients may read the warehouses they have a contract with (names/addresses on their documents)
create policy warehouses_select_client on public.warehouses for select to authenticated
  using (public.client_sees_warehouse(id));

-- ---------- Indexes ----------
create index clients_status_idx         on public.clients (status);
create index contracts_client_idx       on public.contracts (client_id);
create index contracts_warehouse_idx    on public.contracts (warehouse_id);
create index contracts_status_idx       on public.contracts (status);
create index company_master_client_idx  on public.company_master (client_id);

-- ---------- updated_at ----------
create trigger set_updated_at before update on public.clients        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.contracts      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.company_master for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.app_settings   for each row execute function public.set_updated_at();
