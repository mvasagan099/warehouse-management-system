-- =====================================================================
-- Row Level Security for every Phase 1 table.
--   SUPER_ADMIN        : full access
--   WAREHOUSE_MANAGER  : read/write rows of warehouses listed in warehouse_managers
--   STAFF              : read-only for their own warehouse (profiles.warehouse_id)
--   CLIENT             : no access to Phase 1 tables (own profile row only)
--   anon               : nothing (no grants at all)
-- Role checks live in SECURITY DEFINER helper functions so policies stay short
-- and do not recurse into profiles' own RLS.
-- =====================================================================

-- ---------- Helper functions ----------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active and p.deleted_at is null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'SUPER_ADMIN', false)
$$;

create or replace function public.manages_warehouse(p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_warehouse_id is not null
     and public.current_app_role() = 'WAREHOUSE_MANAGER'
     and exists (
       select 1 from public.warehouse_managers wm
       where wm.user_id = auth.uid()
         and wm.warehouse_id = p_warehouse_id
         and wm.deleted_at is null
     )
$$;

create or replace function public.is_staff_of(p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_warehouse_id is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'STAFF' and p.is_active
      and p.deleted_at is null and p.warehouse_id = p_warehouse_id
  )
$$;

-- admin, a manager of the warehouse, or staff of the warehouse
create or replace function public.can_read_warehouse(p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.manages_warehouse(p_warehouse_id) or public.is_staff_of(p_warehouse_id)
$$;

-- admin or a manager of the warehouse
create or replace function public.can_write_warehouse(p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.manages_warehouse(p_warehouse_id)
$$;

-- ---------- Enable RLS on every table ----------
alter table public.profiles            enable row level security;
alter table public.warehouses          enable row level security;
alter table public.warehouse_managers  enable row level security;
alter table public.zones               enable row level security;
alter table public.brigade_types       enable row level security;
alter table public.brigade_slots       enable row level security;
alter table public.vacancies           enable row level security;
alter table public.applicants          enable row level security;
alter table public.audit_logs          enable row level security;

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (role = 'STAFF' and public.manages_warehouse(warehouse_id))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (role = 'STAFF' and public.manages_warehouse(warehouse_id))
  )
  with check (
    id = auth.uid()
    or public.is_admin()
    or (role = 'STAFF' and public.manages_warehouse(warehouse_id))
  );
-- no insert policy: profiles are created by the auth.users trigger only
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- Column-level privilege guard: non-admins may not escalate role, move warehouses,
-- or (re)activate accounts except managers toggling their own STAFF.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- service role / migrations / triggers without a user: trusted
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.warehouse_id is distinct from old.warehouse_id
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
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------- warehouses ----------
create policy warehouses_select on public.warehouses for select to authenticated
  using (public.can_read_warehouse(id));
create policy warehouses_insert on public.warehouses for insert to authenticated
  with check (public.is_admin());
create policy warehouses_update on public.warehouses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy warehouses_delete on public.warehouses for delete to authenticated
  using (public.is_admin());

-- ---------- warehouse_managers ----------
create policy warehouse_managers_select on public.warehouse_managers for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy warehouse_managers_insert on public.warehouse_managers for insert to authenticated
  with check (public.is_admin());
create policy warehouse_managers_update on public.warehouse_managers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy warehouse_managers_delete on public.warehouse_managers for delete to authenticated
  using (public.is_admin());

-- ---------- zones ----------
create policy zones_select on public.zones for select to authenticated
  using (public.can_read_warehouse(warehouse_id));
create policy zones_insert on public.zones for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id));
create policy zones_update on public.zones for update to authenticated
  using (public.can_write_warehouse(warehouse_id))
  with check (public.can_write_warehouse(warehouse_id));
create policy zones_delete on public.zones for delete to authenticated
  using (public.can_write_warehouse(warehouse_id));

-- ---------- brigade_types (global catalogue: admin writes, internal roles read) ----------
create policy brigade_types_select on public.brigade_types for select to authenticated
  using (public.current_app_role() in ('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'));
create policy brigade_types_insert on public.brigade_types for insert to authenticated
  with check (public.is_admin());
create policy brigade_types_update on public.brigade_types for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy brigade_types_delete on public.brigade_types for delete to authenticated
  using (public.is_admin());

-- ---------- brigade_slots ----------
create policy brigade_slots_select on public.brigade_slots for select to authenticated
  using (public.can_read_warehouse(warehouse_id));
create policy brigade_slots_insert on public.brigade_slots for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id));
create policy brigade_slots_update on public.brigade_slots for update to authenticated
  using (public.can_write_warehouse(warehouse_id))
  with check (public.can_write_warehouse(warehouse_id));
create policy brigade_slots_delete on public.brigade_slots for delete to authenticated
  using (public.can_write_warehouse(warehouse_id));

-- ---------- vacancies / applicants (admin + managers of the warehouse; not staff) ----------
create policy vacancies_select on public.vacancies for select to authenticated
  using (public.can_write_warehouse(warehouse_id));
create policy vacancies_insert on public.vacancies for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id));
create policy vacancies_update on public.vacancies for update to authenticated
  using (public.can_write_warehouse(warehouse_id))
  with check (public.can_write_warehouse(warehouse_id));
create policy vacancies_delete on public.vacancies for delete to authenticated
  using (public.is_admin());

create policy applicants_select on public.applicants for select to authenticated
  using (public.can_write_warehouse(warehouse_id));
create policy applicants_insert on public.applicants for insert to authenticated
  with check (public.can_write_warehouse(warehouse_id));
create policy applicants_update on public.applicants for update to authenticated
  using (public.can_write_warehouse(warehouse_id))
  with check (public.can_write_warehouse(warehouse_id));
create policy applicants_delete on public.applicants for delete to authenticated
  using (public.is_admin());

-- ---------- audit_logs: admin read-only; nobody writes except the trigger ----------
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ---------- Grants (defence in depth on top of RLS) ----------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
-- updated_at/created_at are server-managed but harmless; id/role guarded by trigger.

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- helper functions: callable by signed-in users only
revoke execute on all functions in schema public from anon, public;
grant execute on function public.current_app_role()            to authenticated;
grant execute on function public.is_admin()                    to authenticated;
grant execute on function public.manages_warehouse(uuid)       to authenticated;
grant execute on function public.is_staff_of(uuid)             to authenticated;
grant execute on function public.can_read_warehouse(uuid)      to authenticated;
grant execute on function public.can_write_warehouse(uuid)     to authenticated;
