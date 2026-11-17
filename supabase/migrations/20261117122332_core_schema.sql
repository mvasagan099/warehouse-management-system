-- =====================================================================
-- Phase 1 core schema: enums, tables, generic triggers, indexes.
-- Conventions:
--   * every business table has created_at, updated_at, deleted_at (soft delete)
--   * timestamps are timestamptz (stored UTC, displayed Asia/Kolkata in the UI)
--   * money (later phases) is bigint paise; no money columns exist in Phase 1
--   * no sizes / temperatures / rates are hard-coded: they live in rows
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------
create type public.app_role as enum ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF', 'CLIENT');
create type public.storage_type as enum ('DRY', 'CHILLED', 'FROZEN', 'DEEP_FREEZE', 'BONDED', 'HAZMAT');
create type public.slot_status as enum ('FREE', 'OCCUPIED', 'BLOCKED');
create type public.vacancy_status as enum ('OPEN', 'ON_HOLD', 'CLOSED');
create type public.applicant_status as enum ('APPLIED', 'INTERVIEW', 'OFFERED', 'JOINED', 'REJECTED');
create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

-- ---------- Generic updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- warehouses ----------
create sequence public.warehouse_code_seq;

create table public.warehouses (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                     default ('W' || nextval('public.warehouse_code_seq'))
                     check (code ~ '^[A-Z0-9]{1,10}$'),
  name             text not null check (length(trim(name)) > 0),
  address_line1    text,
  address_line2    text,
  city             text,
  district         text,
  state            text not null default 'Tamil Nadu',
  pincode          text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  latitude         numeric(9,6) check (latitude between -90 and 90),
  longitude        numeric(9,6) check (longitude between -180 and 180),
  total_area_sqft  numeric(12,2) check (total_area_sqft is null or total_area_sqft >= 0),
  contact_name     text,
  contact_phone    text,
  contact_email    text,
  opens_at         time,
  closes_at        time,
  is_24x7          boolean not null default false,
  operating_notes  text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
alter sequence public.warehouse_code_seq owned by public.warehouses.code;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  phone                 text,
  role                  public.app_role not null default 'CLIENT',
  -- STAFF belong to exactly one warehouse; managers use warehouse_managers
  warehouse_id          uuid references public.warehouses(id),
  preferred_language    text not null default 'en' check (preferred_language in ('en', 'ta')),
  is_active             boolean not null default true,
  must_change_password  boolean not null default false,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint staff_has_warehouse check (role <> 'STAFF' or warehouse_id is not null)
);

-- ---------- warehouse_managers (manager <-> warehouse, many-to-many) ----------
create table public.warehouse_managers (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  uuid not null references public.warehouses(id),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index warehouse_managers_active_uq
  on public.warehouse_managers (warehouse_id, user_id) where deleted_at is null;

-- ---------- zones ----------
create table public.zones (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  uuid not null references public.warehouses(id),
  code          text not null default '' check (code ~ '^[A-Z0-9]{1,10}$'),  -- '' => auto Z<n>
  name          text not null check (length(trim(name)) > 0),
  storage_type  public.storage_type not null,
  temp_min      numeric(5,2),
  temp_max      numeric(5,2),
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  -- DRY zones have no temperature band; temperature-controlled zones must have one.
  constraint zone_temperature_band check (
    case storage_type
      when 'DRY' then temp_min is null and temp_max is null
      when 'CHILLED' then temp_min is not null and temp_max is not null
      when 'FROZEN' then temp_min is not null and temp_max is not null
      when 'DEEP_FREEZE' then temp_min is not null and temp_max is not null
      else (temp_min is null) = (temp_max is null)       -- BONDED / HAZMAT: optional band
    end
    and (temp_min is null or temp_min <= temp_max)
  ),
  constraint zones_code_per_warehouse unique (warehouse_id, code)
);

-- ---------- brigade_types (admin-customisable storage unit) ----------
create table public.brigade_types (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 0),
  description    text,
  length_m       numeric(6,3) not null check (length_m > 0),
  width_m        numeric(6,3) not null check (width_m > 0),
  height_m       numeric(6,3) not null check (height_m > 0),
  max_weight_kg  numeric(10,2) not null check (max_weight_kg > 0),
  volume_m3      numeric(12,3) generated always as (round(length_m * width_m * height_m, 3)) stored,
  is_default     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index brigade_types_single_default
  on public.brigade_types (is_default) where is_default and deleted_at is null;

-- ---------- brigade_slots ----------
create table public.brigade_slots (
  id               uuid primary key default gen_random_uuid(),
  warehouse_id     uuid not null references public.warehouses(id),
  zone_id          uuid not null references public.zones(id),
  brigade_type_id  uuid not null references public.brigade_types(id),
  aisle            integer not null check (aisle > 0),
  rack             integer not null check (rack > 0),
  level            integer not null check (level > 0),
  position         integer not null check (position > 0),
  code             text not null unique,
  status           public.slot_status not null default 'FREE',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint brigade_slots_location_uq unique (zone_id, aisle, rack, level, position)
);
-- EXTENSION POINT (Phase 2+): stock / inward receipts will reference brigade_slots.id
-- and move status FREE -> OCCUPIED. Nothing in Phase 1 sets OCCUPIED automatically.

-- ---------- vacancies / applicants (basic hiring) ----------
create table public.vacancies (
  id             uuid primary key default gen_random_uuid(),
  warehouse_id   uuid references public.warehouses(id),   -- null = head office (admin only)
  title          text not null check (length(trim(title)) > 0),
  role_to_hire   public.app_role not null default 'STAFF'
                   check (role_to_hire in ('WAREHOUSE_MANAGER', 'STAFF')),
  description    text,
  openings       integer not null default 1 check (openings > 0),
  status         public.vacancy_status not null default 'OPEN',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table public.applicants (
  id                 uuid primary key default gen_random_uuid(),
  vacancy_id         uuid not null references public.vacancies(id),
  warehouse_id       uuid references public.warehouses(id),  -- copied from vacancy by trigger
  full_name          text not null check (length(trim(full_name)) > 0),
  email              text,
  phone              text,
  status             public.applicant_status not null default 'APPLIED',
  status_changed_at  timestamptz not null default now(),
  notes              text,
  user_id            uuid references public.profiles(id) on delete set null,  -- set when account created
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- ---------- audit_logs (append-only, written only by trigger) ----------
create table public.audit_logs (
  id            bigint generated always as identity primary key,
  table_name    text not null,
  record_id     uuid,
  warehouse_id  uuid,
  action        public.audit_action not null,
  old_data      jsonb,
  new_data      jsonb,
  changed_by    uuid,           -- auth.uid(); null = system / service role
  changed_at    timestamptz not null default now()
);

-- ---------- Indexes ----------
create index profiles_role_idx            on public.profiles (role);
create index profiles_warehouse_idx       on public.profiles (warehouse_id);
create index warehouse_managers_user_idx  on public.warehouse_managers (user_id);
create index warehouse_managers_wh_idx    on public.warehouse_managers (warehouse_id);
create index zones_warehouse_idx          on public.zones (warehouse_id);
create index brigade_slots_warehouse_idx  on public.brigade_slots (warehouse_id);
create index brigade_slots_zone_idx       on public.brigade_slots (zone_id);
create index brigade_slots_status_idx     on public.brigade_slots (status);
create index brigade_slots_type_idx       on public.brigade_slots (brigade_type_id);
create index vacancies_warehouse_idx      on public.vacancies (warehouse_id);
create index vacancies_status_idx         on public.vacancies (status);
create index applicants_vacancy_idx       on public.applicants (vacancy_id);
create index applicants_warehouse_idx     on public.applicants (warehouse_id);
create index applicants_status_idx        on public.applicants (status);
create index audit_logs_record_idx        on public.audit_logs (table_name, record_id);
create index audit_logs_changed_at_idx    on public.audit_logs (changed_at desc);
create index audit_logs_warehouse_idx     on public.audit_logs (warehouse_id);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['warehouses','profiles','warehouse_managers','zones',
                           'brigade_types','brigade_slots','vacancies','applicants']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- Denormalisation guards ----------
-- brigade_slots.warehouse_id always follows its zone (so RLS on warehouse_id can't be spoofed)
create or replace function public.slot_sync_warehouse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select z.warehouse_id into new.warehouse_id from public.zones z where z.id = new.zone_id;
  if new.warehouse_id is null then
    raise exception 'Zone % not found', new.zone_id using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger slot_sync_warehouse before insert or update of zone_id, warehouse_id
  on public.brigade_slots for each row execute function public.slot_sync_warehouse();

-- applicants.warehouse_id always follows its vacancy
create or replace function public.applicant_sync_warehouse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select v.warehouse_id into new.warehouse_id from public.vacancies v where v.id = new.vacancy_id;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger applicant_sync_warehouse before insert or update
  on public.applicants for each row execute function public.applicant_sync_warehouse();

-- zone code defaults to Z<n> within its warehouse when not supplied
create or replace function public.zone_default_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is null or new.code = '' then
    select 'Z' || (count(*) + 1) into new.code from public.zones z where z.warehouse_id = new.warehouse_id;
  end if;
  new.code := upper(new.code);
  return new;
end;
$$;
create trigger zone_default_code before insert on public.zones
  for each row execute function public.zone_default_code();

-- ---------- Profile creation from auth.users ----------
-- Role comes ONLY from raw_app_meta_data (settable only with the service key),
-- never from user-editable user_metadata. Default is CLIENT (no Phase 1 access).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, warehouse_id, must_change_password, created_by)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'CLIENT'),
    nullif(new.raw_app_meta_data ->> 'warehouse_id', '')::uuid,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false),
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- GoTrue's admin createUser writes app_metadata in a follow-up UPDATE, so sync the
-- provisioning keys when they change. Only the service key can change app_metadata.
-- Untouched keys are left alone, so later admin edits in profiles are not overwritten.
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
     or (n -> 'must_change_password') is distinct from (o -> 'must_change_password')
     or (n -> 'created_by') is distinct from (o -> 'created_by') then
    update public.profiles p set
      role = case when (n -> 'role') is distinct from (o -> 'role') and n ? 'role'
                  then (n ->> 'role')::public.app_role else p.role end,
      warehouse_id = case when (n -> 'warehouse_id') is distinct from (o -> 'warehouse_id')
                          then nullif(n ->> 'warehouse_id', '')::uuid else p.warehouse_id end,
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
create trigger on_auth_user_app_metadata after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_app_metadata();
