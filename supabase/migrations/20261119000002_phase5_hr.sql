-- =====================================================================
-- Phase 5 / 1: hiring, employees, shifts, attendance, manager assignment, crew log.
-- Sensitive HR data (salary, ID proof, bank details) lives in admin-only tables and never in lists or logs.
-- =====================================================================

-- ---------- redact sensitive keys in the audit log (value replaced, change still recorded) ----------
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb; v_new jsonb; v_id uuid; v_wh uuid; k text;
  sensitive text[] := array['bank_account_no', 'bank_ifsc', 'bank_account_holder', 'bank_name', 'id_proof_path', 'key_hash', 'password'];
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then return null; end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  if tg_table_name = 'warehouses' then v_wh := v_id;
  else v_wh := nullif(coalesce(v_new ->> 'warehouse_id', v_old ->> 'warehouse_id'), '')::uuid; end if;
  foreach k in array sensitive loop
    if v_old ? k and v_old ->> k is not null then v_old := jsonb_set(v_old, array[k], '"***"'); end if;
    if v_new ? k and v_new ->> k is not null then v_new := jsonb_set(v_new, array[k], '"***"'); end if;
  end loop;
  insert into public.audit_logs (table_name, record_id, warehouse_id, action, old_data, new_data, changed_by)
  values (tg_table_name, v_id, v_wh, tg_op::public.audit_action, v_old, v_new, auth.uid());
  return null;
end;
$$;

-- ---------- vacancies / applicants ----------
alter table public.vacancies drop constraint if exists vacancies_role_to_hire_check;
alter table public.vacancies add constraint vacancies_role_to_hire_check check (role_to_hire in ('WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT'));
alter table public.vacancies add column job_role public.job_role not null default 'LOADER';

create table public.vacancy_salaries (            -- admin-only
  vacancy_id  uuid primary key references public.vacancies(id) on delete cascade,
  min_paise   bigint not null check (min_paise >= 0),
  max_paise   bigint not null check (max_paise >= min_paise),
  updated_at  timestamptz not null default now()
);

alter table public.applicants
  add column source text,
  add column resume_path text,
  add column offer_letter_path text,
  add column offer_issued_at timestamptz,
  add column expected_joining date;

create or replace function public.applicant_status_guard() returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'JOINED' and new.user_id is null then
    raise exception 'An applicant can only be marked JOINED when their login is created' using errcode = 'WMS50';
  end if;
  return new;
end $$;
create trigger applicant_status_guard before insert or update on public.applicants for each row execute function public.applicant_status_guard();

create table public.interview_rounds (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references public.applicants(id),
  warehouse_id  uuid references public.warehouses(id),
  round_no      integer not null check (round_no > 0),
  scheduled_at  timestamptz not null,
  interviewer   text not null check (length(trim(interviewer)) > 0),
  notes         text,
  score         integer check (score between 0 and 10),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (applicant_id, round_no)
);
create index interview_rounds_applicant_idx on public.interview_rounds (applicant_id);
create or replace function public.round_sync_warehouse() returns trigger language plpgsql set search_path = ''
as $$ begin select a.warehouse_id into new.warehouse_id from public.applicants a where a.id = new.applicant_id; return new; end $$;
create trigger round_sync_warehouse before insert or update on public.interview_rounds for each row execute function public.round_sync_warehouse();

-- ---------- employees ----------
create sequence public.employee_code_seq;
create table public.employees (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique default ('E' || lpad(nextval('public.employee_code_seq')::text, 4, '0')),
  user_id                 uuid not null unique references public.profiles(id) on delete cascade,
  warehouse_id            uuid references public.warehouses(id),
  applicant_id            uuid references public.applicants(id),
  job_role                public.job_role not null default 'LOADER',
  joining_date            date not null default current_date,
  emergency_contact_name  text,
  emergency_contact_phone text,
  status                  public.employee_status not null default 'ACTIVE',
  exit_date               date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  check (exit_date is null or exit_date >= joining_date)
);
create index employees_warehouse_idx on public.employees (warehouse_id);

create table public.employee_private (             -- admin-only; never listed, audit-logged with values masked
  employee_id         uuid primary key references public.employees(id) on delete cascade,
  warehouse_id        uuid,
  id_proof_type       text,
  id_proof_path       text,
  bank_account_holder text,
  bank_name           text,
  bank_account_no     text,
  bank_ifsc           text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  updated_at          timestamptz not null default now()
);
create unique index employee_private_id_uq on public.employee_private (employee_id);

-- every staff / manager / accountant profile gets an employee record
create or replace function public.profile_employee_sync() returns trigger language plpgsql security definer set search_path = ''
as $$
declare r public.job_role;
begin
  if new.role in ('STAFF', 'WAREHOUSE_MANAGER', 'ACCOUNTANT') then
    r := case new.role when 'WAREHOUSE_MANAGER' then 'MANAGER' when 'ACCOUNTANT' then 'ACCOUNTANT' else 'LOADER' end;
    insert into public.employees (user_id, warehouse_id, job_role) values (new.id, new.warehouse_id, r)
    on conflict (user_id) do update set warehouse_id = coalesce(excluded.warehouse_id, public.employees.warehouse_id);
  end if;
  return null;
end $$;
create trigger profile_employee_sync after insert or update of role, warehouse_id on public.profiles for each row execute function public.profile_employee_sync();

-- a JOINED applicant fills the employee record (login and employee in one step, via create-user)
create or replace function public.applicant_joined() returns trigger language plpgsql security definer set search_path = ''
as $$
declare v public.vacancies;
begin
  if new.status = 'JOINED' and new.user_id is not null and (tg_op = 'INSERT' or old.status is distinct from 'JOINED') then
    select * into v from public.vacancies where id = new.vacancy_id;
    insert into public.employees (user_id, warehouse_id, applicant_id, job_role, joining_date)
    values (new.user_id, new.warehouse_id, new.id, coalesce(v.job_role, 'LOADER'), coalesce(new.expected_joining, current_date))
    on conflict (user_id) do update set applicant_id = excluded.applicant_id, job_role = excluded.job_role,
      joining_date = excluded.joining_date, warehouse_id = coalesce(excluded.warehouse_id, public.employees.warehouse_id);
  end if;
  return null;
end $$;
create trigger applicant_joined after insert or update on public.applicants for each row execute function public.applicant_joined();

-- exit: deactivates the login, keeps every record
create or replace function public.exit_employee(p_employee_id uuid, p_exit_date date default current_date) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.employees;
begin
  select * into e from public.employees where id = p_employee_id and deleted_at is null;
  if e.id is null then raise exception 'Employee not found' using errcode = 'P0002'; end if;
  if not (public.is_admin() or public.manages_warehouse(e.warehouse_id)) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if e.user_id = auth.uid() then raise exception 'You cannot exit yourself' using errcode = 'WMS51'; end if;
  update public.employees set status = 'EXITED', exit_date = greatest(p_exit_date, joining_date) where id = e.id;
  update public.profiles set is_active = false where id = e.user_id;
end $$;

-- ---------- shifts, roster, attendance ----------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  name text not null check (length(trim(name)) > 0),
  starts_at time not null, ends_at time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (warehouse_id, name)
);
create table public.shift_roster (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  shift_id uuid not null references public.shifts(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, work_date, shift_id)
);
create index shift_roster_wh_date_idx on public.shift_roster (warehouse_id, work_date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz, check_out_at timestamptz,
  check_in_lat numeric(9,6), check_in_lon numeric(9,6), check_in_distance_m integer, gps_ok boolean,
  check_out_lat numeric(9,6), check_out_lon numeric(9,6),
  correction_status public.correction_status not null default 'NONE',
  correction_in timestamptz, correction_out timestamptz, correction_reason text,
  decided_by uuid, decided_at timestamptz, decision_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, work_date),
  check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);
create index attendance_wh_date_idx on public.attendance (warehouse_id, work_date);
create index attendance_pending_idx on public.attendance (warehouse_id) where correction_status = 'PENDING';

-- ---------- crew log (which workers handled a lorry; reports only, never billing) ----------
create table public.crew_log (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  document_type text not null check (document_type in ('INWARD_RECEIPT', 'DELIVERY_CHALLAN')),
  document_id uuid not null,
  user_id uuid not null references public.profiles(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (document_type, document_id, user_id)
);
create index crew_log_doc_idx on public.crew_log (document_type, document_id);
create index crew_log_user_idx on public.crew_log (user_id);

-- ---------- settings ----------
insert into public.app_settings (key, value, description) values
  ('hr', '{"gps_required": false, "gps_radius_m": 300, "late_entry_hours": 24, "timezone": "Asia/Kolkata"}', 'Attendance: GPS rule, radius in metres, how late an offline check-in may be synced')
on conflict (key) do nothing;

create or replace function public.hr_setting(p_key text) returns text language sql stable security definer set search_path = ''
as $$ select value ->> p_key from public.app_settings where key = 'hr' $$;

-- ---------- attendance functions ----------
create or replace function public.haversine_m(a_lat numeric, a_lon numeric, b_lat numeric, b_lon numeric) returns integer
language sql immutable set search_path = '' as $$
  select round(2 * 6371000 * asin(sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lon - a_lon) / 2), 2))))::integer $$;

create or replace function public.attendance_punch(p_kind text, p_lat numeric, p_lon numeric, p_at timestamptz, p_warehouse_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; wh uuid; w public.warehouses; v_at timestamptz := coalesce(p_at, now());
  v_day date; dist integer; ok boolean; need_gps boolean; radius integer; a public.attendance;
begin
  select * into me from public.profiles where id = auth.uid() and is_active and deleted_at is null;
  if me.id is null or me.role not in ('STAFF', 'WAREHOUSE_MANAGER') then raise exception 'Only warehouse staff and managers record attendance' using errcode = 'WMS03'; end if;
  wh := coalesce(p_warehouse_id, me.warehouse_id);
  if wh is null or not public.can_read_warehouse(wh) then raise exception 'Choose one of your warehouses' using errcode = 'WMS03'; end if;
  if v_at > now() + interval '5 minutes' then raise exception 'Time is in the future' using errcode = 'WMS52'; end if;
  if v_at < now() - make_interval(hours => coalesce(public.hr_setting('late_entry_hours'), '24')::int) then
    raise exception 'Too old to record; ask your manager for a correction' using errcode = 'WMS52'; end if;
  v_day := (v_at at time zone 'Asia/Kolkata')::date;
  select * into w from public.warehouses where id = wh;
  need_gps := coalesce(public.hr_setting('gps_required'), 'false')::boolean;
  radius := coalesce(public.hr_setting('gps_radius_m'), '300')::int;
  if p_lat is not null and p_lon is not null and w.latitude is not null and w.longitude is not null then
    dist := public.haversine_m(p_lat, p_lon, w.latitude, w.longitude);
    ok := dist <= radius;
  end if;
  if need_gps and ok is not true then
    raise exception 'You must be at the warehouse to do this (GPS check)' using errcode = 'WMS53';
  end if;
  select * into a from public.attendance where user_id = me.id and work_date = v_day;
  if p_kind = 'IN' then
    if a.id is not null and a.check_in_at is not null then return jsonb_build_object('status', 'ALREADY', 'attendance_id', a.id, 'check_in_at', a.check_in_at); end if;
    insert into public.attendance (warehouse_id, user_id, work_date, check_in_at, check_in_lat, check_in_lon, check_in_distance_m, gps_ok)
    values (wh, me.id, v_day, v_at, p_lat, p_lon, dist, ok)
    on conflict (user_id, work_date) do update set check_in_at = excluded.check_in_at, check_in_lat = excluded.check_in_lat,
      check_in_lon = excluded.check_in_lon, check_in_distance_m = excluded.check_in_distance_m, gps_ok = excluded.gps_ok
    returning * into a;
    return jsonb_build_object('status', 'OK', 'attendance_id', a.id, 'gps_ok', ok, 'distance_m', dist);
  else
    if a.id is null or a.check_in_at is null then raise exception 'Check in first' using errcode = 'WMS54'; end if;
    if a.check_out_at is not null then return jsonb_build_object('status', 'ALREADY', 'attendance_id', a.id, 'check_out_at', a.check_out_at); end if;
    if v_at < a.check_in_at then raise exception 'Check-out is before check-in' using errcode = 'WMS52'; end if;
    update public.attendance set check_out_at = v_at, check_out_lat = p_lat, check_out_lon = p_lon where id = a.id;
    return jsonb_build_object('status', 'OK', 'attendance_id', a.id, 'gps_ok', ok, 'distance_m', dist);
  end if;
end $$;
create or replace function public.check_in(p_lat numeric default null, p_lon numeric default null, p_at timestamptz default null, p_warehouse_id uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$ select public.attendance_punch('IN', p_lat, p_lon, p_at, p_warehouse_id) $$;
create or replace function public.check_out(p_lat numeric default null, p_lon numeric default null, p_at timestamptz default null, p_warehouse_id uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$ select public.attendance_punch('OUT', p_lat, p_lon, p_at, p_warehouse_id) $$;

create or replace function public.request_attendance_correction(p_work_date date, p_in timestamptz, p_out timestamptz, p_reason text, p_warehouse_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me public.profiles; wh uuid; a public.attendance;
begin
  select * into me from public.profiles where id = auth.uid() and is_active;
  if me.id is null or me.role not in ('STAFF', 'WAREHOUSE_MANAGER') then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'A reason is required' using errcode = 'WMS55'; end if;
  if p_work_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Date is in the future' using errcode = 'WMS52'; end if;
  if p_in is null or (p_out is not null and p_out < p_in) then raise exception 'Check the times' using errcode = 'WMS52'; end if;
  wh := coalesce(p_warehouse_id, me.warehouse_id);
  if wh is null or not public.can_read_warehouse(wh) then raise exception 'Choose one of your warehouses' using errcode = 'WMS03'; end if;
  insert into public.attendance (warehouse_id, user_id, work_date, correction_status, correction_in, correction_out, correction_reason)
  values (wh, me.id, p_work_date, 'PENDING', p_in, p_out, trim(p_reason))
  on conflict (user_id, work_date) do update set correction_status = 'PENDING', correction_in = excluded.correction_in,
    correction_out = excluded.correction_out, correction_reason = excluded.correction_reason, decided_by = null, decided_at = null, decision_note = null
  returning * into a;
  return a.id;
end $$;

create or replace function public.decide_attendance_correction(p_attendance_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.attendance;
begin
  select * into a from public.attendance where id = p_attendance_id for update;
  if a.id is null or a.correction_status <> 'PENDING' then raise exception 'No pending correction' using errcode = 'WMS55'; end if;
  if not public.can_write_warehouse(a.warehouse_id) then raise exception 'Only a manager or administrator can decide' using errcode = 'WMS03'; end if;
  if a.user_id = auth.uid() then raise exception 'You cannot approve your own correction' using errcode = 'WMS51'; end if;
  if p_approve then
    update public.attendance set check_in_at = a.correction_in, check_out_at = a.correction_out, correction_status = 'APPROVED',
      decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = a.id;
  else
    update public.attendance set correction_status = 'REJECTED', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = a.id;
  end if;
end $$;

create or replace function public.attendance_report(p_warehouse_id uuid, p_from date, p_to date)
returns table (employee_code text, full_name text, job_role public.job_role, work_date date, check_in_at timestamptz, check_out_at timestamptz,
               hours numeric, gps_ok boolean, correction_status public.correction_status)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_write_warehouse(p_warehouse_id) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  return query
  select e.code, p.full_name, e.job_role, a.work_date, a.check_in_at, a.check_out_at,
         case when a.check_in_at is not null and a.check_out_at is not null then round(extract(epoch from a.check_out_at - a.check_in_at) / 3600.0, 2) end,
         a.gps_ok, a.correction_status
  from public.attendance a join public.profiles p on p.id = a.user_id left join public.employees e on e.user_id = a.user_id
  where a.warehouse_id = p_warehouse_id and a.work_date between p_from and p_to
  order by a.work_date, p.full_name;
end $$;

-- ---------- manager assignment ----------
create or replace function public.assign_manager(p_user_id uuid, p_warehouse_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can assign managers' using errcode = 'WMS03'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'WAREHOUSE_MANAGER' and is_active and deleted_at is null) then
    raise exception 'That user is not an active warehouse manager' using errcode = 'WMS56'; end if;
  insert into public.warehouse_managers (warehouse_id, user_id) values (p_warehouse_id, p_user_id)
  on conflict (warehouse_id, user_id) where deleted_at is null do nothing;
end $$;

-- returns the warning instead of failing silently: removal of the last manager needs p_confirm = true
create or replace function public.remove_manager(p_user_id uuid, p_warehouse_id uuid, p_confirm boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare remaining integer;
begin
  if not public.is_admin() then raise exception 'Only an administrator can remove managers' using errcode = 'WMS03'; end if;
  select count(*) into remaining from public.warehouse_managers wm join public.profiles p on p.id = wm.user_id
   where wm.warehouse_id = p_warehouse_id and wm.deleted_at is null and wm.user_id <> p_user_id and p.is_active and p.deleted_at is null;
  if remaining = 0 and not p_confirm then
    return jsonb_build_object('removed', false, 'warning', 'NO_MANAGER_LEFT');
  end if;
  update public.warehouse_managers set deleted_at = now() where warehouse_id = p_warehouse_id and user_id = p_user_id and deleted_at is null;
  return jsonb_build_object('removed', true, 'warning', case when remaining = 0 then 'NO_MANAGER_LEFT' end);
end $$;

create or replace view public.warehouse_manager_counts with (security_invoker = true) as
select w.id as warehouse_id, w.code, w.name,
  (select count(*) from public.warehouse_managers wm join public.profiles p on p.id = wm.user_id
    where wm.warehouse_id = w.id and wm.deleted_at is null and p.is_active and p.deleted_at is null)::int as managers
from public.warehouses w where w.deleted_at is null and w.is_active;

-- ---------- crew log ----------
create or replace function public.set_crew(p_document_type text, p_document_id uuid, p_user_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare wh uuid; u uuid; n integer := 0;
begin
  if p_document_type = 'INWARD_RECEIPT' then select warehouse_id into wh from public.inward_receipts where id = p_document_id;
  elsif p_document_type = 'DELIVERY_CHALLAN' then select warehouse_id into wh from public.delivery_challans where id = p_document_id;
  else raise exception 'Unknown document type' using errcode = 'WMS57'; end if;
  if wh is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not public.can_operate_warehouse(wh) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  delete from public.crew_log where document_type = p_document_type and document_id = p_document_id;
  foreach u in array coalesce(p_user_ids, '{}') loop
    if not exists (select 1 from public.profiles p where p.id = u and p.is_active and
         (p.warehouse_id = wh or exists (select 1 from public.warehouse_managers m where m.user_id = u and m.warehouse_id = wh and m.deleted_at is null))) then
      raise exception 'Worker does not belong to this warehouse' using errcode = 'WMS57'; end if;
    insert into public.crew_log (warehouse_id, document_type, document_id, user_id) values (wh, p_document_type, p_document_id, u);
    n := n + 1;
  end loop;
  return n;
end $$;

-- who was on duty (checked in, not checked out) around a time at a warehouse
create or replace function public.on_duty_at(p_warehouse_id uuid, p_at timestamptz default now())
returns table (user_id uuid, full_name text, job_role public.job_role, check_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.user_id, p.full_name, e.job_role, a.check_in_at
  from public.attendance a join public.profiles p on p.id = a.user_id left join public.employees e on e.user_id = a.user_id
  where a.warehouse_id = p_warehouse_id and public.can_read_warehouse(p_warehouse_id)
    and a.check_in_at <= p_at and (a.check_out_at is null or a.check_out_at >= p_at) and a.check_in_at > p_at - interval '24 hours'
  order by p.full_name $$;

-- ---------- RLS ----------
alter table public.vacancy_salaries enable row level security;
alter table public.interview_rounds enable row level security;
alter table public.employees        enable row level security;
alter table public.employee_private enable row level security;
alter table public.shifts           enable row level security;
alter table public.shift_roster     enable row level security;
alter table public.attendance       enable row level security;
alter table public.crew_log         enable row level security;

create policy vacancy_salaries_all on public.vacancy_salaries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rounds_select on public.interview_rounds for select to authenticated using (public.can_write_warehouse(warehouse_id));
create policy rounds_insert on public.interview_rounds for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy rounds_update on public.interview_rounds for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy employees_select on public.employees for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or (warehouse_id is not null and public.manages_warehouse(warehouse_id)));
create policy employees_update on public.employees for update to authenticated
  using (public.is_admin() or (warehouse_id is not null and public.manages_warehouse(warehouse_id)))
  with check (public.is_admin() or (warehouse_id is not null and public.manages_warehouse(warehouse_id)));
create policy employee_private_all on public.employee_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy shifts_select on public.shifts for select to authenticated using (public.can_read_warehouse(warehouse_id));
create policy shifts_insert on public.shifts for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy shifts_update on public.shifts for update to authenticated using (public.can_write_warehouse(warehouse_id)) with check (public.can_write_warehouse(warehouse_id));
create policy roster_select on public.shift_roster for select to authenticated using (user_id = auth.uid() or public.can_write_warehouse(warehouse_id));
create policy roster_insert on public.shift_roster for insert to authenticated with check (public.can_write_warehouse(warehouse_id));
create policy roster_delete on public.shift_roster for delete to authenticated using (public.can_write_warehouse(warehouse_id));
create policy attendance_select on public.attendance for select to authenticated using (user_id = auth.uid() or public.can_write_warehouse(warehouse_id));
create policy crew_select on public.crew_log for select to authenticated using (public.can_read_warehouse(warehouse_id));

revoke all on public.vacancy_salaries, public.interview_rounds, public.employees, public.employee_private, public.shifts, public.shift_roster,
  public.attendance, public.crew_log from anon;
revoke insert, delete on public.employees from authenticated;                   -- created by triggers only
revoke update (user_id, code, applicant_id, joining_date) on public.employees from authenticated;
revoke insert, update, delete on public.attendance, public.crew_log from authenticated;   -- via functions
grant update (job_role, emergency_contact_name, emergency_contact_phone, status, exit_date, joining_date) on public.employees to authenticated;
revoke delete on public.interview_rounds, public.shifts from authenticated;
revoke execute on all functions in schema public from anon, public;
revoke execute on function public.attendance_punch(text, numeric, numeric, timestamptz, uuid), public.hr_setting(text),
  public.profile_employee_sync(), public.applicant_joined(), public.applicant_status_guard(), public.round_sync_warehouse(), public.haversine_m(numeric, numeric, numeric, numeric) from authenticated;

do $$ declare t text; begin
  foreach t in array array['vacancy_salaries', 'interview_rounds', 'employees', 'employee_private', 'shifts', 'attendance', 'crew_log'] loop
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- ---------- private HR bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr', 'hr', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) on conflict (id) do nothing;
-- resume/<warehouse|hq>/<applicant>/file, offer/<warehouse|hq>/<applicant>/file : admin, or manager of that warehouse
-- idproof/<employee>/file : administrator only
create or replace function public.hr_object_allowed(p_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    (storage.foldername(p_name))[1] in ('resume', 'offer') and (storage.foldername(p_name))[2] ~ '^[0-9a-f-]{36}$'
    and public.manages_warehouse(((storage.foldername(p_name))[2])::uuid)) $$;
create policy wms_hr_select on storage.objects for select to authenticated using (bucket_id = 'hr' and public.hr_object_allowed(name));
create policy wms_hr_insert on storage.objects for insert to authenticated with check (bucket_id = 'hr' and public.hr_object_allowed(name));
create policy wms_hr_update on storage.objects for update to authenticated using (bucket_id = 'hr' and public.hr_object_allowed(name));
create policy wms_hr_delete on storage.objects for delete to authenticated using (bucket_id = 'hr' and public.is_admin());
