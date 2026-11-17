-- =====================================================================
-- Phase 2: space booking and slot reservation.
-- =====================================================================

-- Does a zone (type + temperature band) satisfy a requirement?
--   r_set        exact set-point the goods need (must lie inside the zone band)
--   r_min/r_max  band the goods need (zone band must cover it)
--   r_type       storage type the goods need (must equal the zone type)
create or replace function public.zone_matches_temp(
  z_type public.storage_type, z_min numeric, z_max numeric,
  r_type public.storage_type, r_set numeric, r_min numeric, r_max numeric
)
returns boolean
language sql immutable set search_path = ''
as $$
  select (r_type is null or z_type = r_type)
     and case
           when r_set is not null then z_min is not null and z_max is not null and r_set between z_min and z_max
           when r_min is not null and r_max is not null then z_min is not null and z_max is not null
                                                          and z_min <= r_min and z_max >= r_max
           else true
         end
$$;

-- ---------- space_bookings ----------
create table public.space_bookings (
  id                  uuid primary key default gen_random_uuid(),
  booking_no          text unique,
  client_id           uuid not null references public.clients(id),
  warehouse_id        uuid not null references public.warehouses(id),
  storage_type        public.storage_type not null,
  temp_setpoint_c     numeric(5,2),
  temp_min            numeric(5,2),
  temp_max            numeric(5,2),
  brigade_type_id     uuid references public.brigade_types(id),
  brigades_requested  integer not null check (brigades_requested > 0),
  from_date           date not null,
  expected_days       integer not null check (expected_days > 0),
  status              public.booking_status not null default 'REQUESTED',
  reserved_count      integer not null default 0 check (reserved_count >= 0),
  remarks             text,
  requested_by        uuid default auth.uid(),
  decided_by          uuid,
  decided_at          timestamptz,
  decision_note       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint booking_temperature check (
    case
      when storage_type = 'DRY' then temp_setpoint_c is null and temp_min is null and temp_max is null
      when storage_type in ('CHILLED', 'FROZEN', 'DEEP_FREEZE')
        then temp_setpoint_c is not null or (temp_min is not null and temp_max is not null)
      else true
    end
    and (temp_min is null) = (temp_max is null)
    and (temp_min is null or temp_min <= temp_max)
  )
);
create index space_bookings_client_idx    on public.space_bookings (client_id);
create index space_bookings_warehouse_idx on public.space_bookings (warehouse_id);
create index space_bookings_status_idx    on public.space_bookings (status);

-- ---------- slot reservation columns ----------
alter table public.brigade_slots
  add column reserved_client_id uuid references public.clients(id),
  add column booking_id uuid references public.space_bookings(id);
create index brigade_slots_reserved_client_idx on public.brigade_slots (reserved_client_id);
create index brigade_slots_booking_idx on public.brigade_slots (booking_id);

-- API users (role authenticated) may only toggle FREE <-> BLOCKED. RESERVED and
-- OCCUPIED are driven by the booking and stock functions (which run as owner).
create or replace function public.brigade_slots_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('FREE', 'BLOCKED') or new.reserved_client_id is not null or new.booking_id is not null then
      raise exception 'New slots must be FREE or BLOCKED' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.reserved_client_id is distinct from old.reserved_client_id or new.booking_id is distinct from old.booking_id then
    raise exception 'Slot reservations change only through bookings' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and (old.status not in ('FREE', 'BLOCKED') or new.status not in ('FREE', 'BLOCKED')) then
    raise exception 'Reserved or occupied slots change status only through bookings and stock documents'
      using errcode = '42501';
  end if;
  if old.status in ('RESERVED', 'OCCUPIED')
     and (new.zone_id is distinct from old.zone_id
          or new.brigade_type_id is distinct from old.brigade_type_id
          or new.deleted_at is distinct from old.deleted_at) then
    raise exception 'Reserved or occupied slots cannot be moved or removed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a_brigade_slots_guard before insert or update on public.brigade_slots
  for each row execute function public.brigade_slots_guard();

-- Booking inserts from the API always start as REQUESTED by the caller.
create or replace function public.space_bookings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.status := 'REQUESTED';
  new.reserved_count := 0;
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  new.booking_no := null;
  new.requested_by := auth.uid();
  if not public.client_has_active_contract(new.client_id, new.warehouse_id, new.from_date) then
    raise exception 'Client has no active contract with this warehouse on %', new.from_date using errcode = 'WMS14';
  end if;
  return new;
end;
$$;
create trigger a_space_bookings_guard before insert on public.space_bookings
  for each row execute function public.space_bookings_guard();
create trigger b_space_bookings_number before insert on public.space_bookings
  for each row execute function public.assign_doc_number('BK', 'booking_no');
create trigger set_updated_at before update on public.space_bookings
  for each row execute function public.set_updated_at();

alter table public.space_bookings enable row level security;
create policy space_bookings_select on public.space_bookings for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy space_bookings_insert on public.space_bookings for insert to authenticated
  with check (
    public.can_write_warehouse(warehouse_id)
    or (public.is_my_client(client_id) and public.client_sees_warehouse(warehouse_id))
  );
-- no update/delete policies: decisions go through the functions below

-- ---------- availability ----------
create or replace function public.check_space_availability(
  p_warehouse_id     uuid,
  p_storage_type     public.storage_type,
  p_setpoint         numeric default null,
  p_temp_min         numeric default null,
  p_temp_max         numeric default null,
  p_brigade_type_id  uuid default null
)
returns table (
  zone_id uuid, zone_code text, zone_name text, storage_type public.storage_type,
  temp_min numeric, temp_max numeric, free_slots integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.can_read_warehouse(p_warehouse_id) or public.client_sees_warehouse(p_warehouse_id)) then
    raise exception 'Not allowed to check this warehouse' using errcode = '42501';
  end if;
  return query
    select z.id, z.code, z.name, z.storage_type, z.temp_min, z.temp_max,
           (count(s.id) filter (where s.status = 'FREE'
                                  and (p_brigade_type_id is null or s.brigade_type_id = p_brigade_type_id)))::integer
    from public.zones z
    left join public.brigade_slots s on s.zone_id = z.id and s.deleted_at is null
    where z.warehouse_id = p_warehouse_id and z.deleted_at is null and z.is_active
      and public.zone_matches_temp(z.storage_type, z.temp_min, z.temp_max, p_storage_type, p_setpoint, p_temp_min, p_temp_max)
    group by z.id, z.code, z.name, z.storage_type, z.temp_min, z.temp_max
    order by z.code;
end;
$$;

-- ---------- decisions ----------
create or replace function public.approve_booking(p_booking_id uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b      public.space_bookings;
  v_ids  uuid[];
  v_n    integer;
begin
  select * into b from public.space_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(b.warehouse_id) then
    raise exception 'Only a manager of this warehouse can approve bookings' using errcode = '42501';
  end if;
  if b.status <> 'REQUESTED' then
    raise exception 'Booking is already %', b.status using errcode = 'WMS03';
  end if;

  select array_agg(t.id) into v_ids from (
    select s.id
    from public.brigade_slots s
    join public.zones z on z.id = s.zone_id
    where s.warehouse_id = b.warehouse_id and s.status = 'FREE' and s.deleted_at is null
      and z.deleted_at is null and z.is_active
      and (b.brigade_type_id is null or s.brigade_type_id = b.brigade_type_id)
      and public.zone_matches_temp(z.storage_type, z.temp_min, z.temp_max,
                                   b.storage_type, b.temp_setpoint_c, b.temp_min, b.temp_max)
    order by z.code, s.aisle, s.rack, s.level, s.position
    limit b.brigades_requested
    for update of s skip locked
  ) t;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < b.brigades_requested then
    raise exception 'Not enough free slots: % requested, % available', b.brigades_requested, v_n
      using errcode = 'WMS05';
  end if;

  update public.brigade_slots
     set status = 'RESERVED', reserved_client_id = b.client_id, booking_id = b.id
   where id = any (v_ids);
  update public.space_bookings
     set status = 'APPROVED', reserved_count = v_n, decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = b.id;
  return v_n;
end;
$$;

create or replace function public.reject_booking(p_booking_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare b public.space_bookings;
begin
  select * into b from public.space_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not public.can_write_warehouse(b.warehouse_id) then
    raise exception 'Only a manager of this warehouse can reject bookings' using errcode = '42501';
  end if;
  if b.status <> 'REQUESTED' then
    raise exception 'Booking is already %', b.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required' using errcode = 'WMS08';
  end if;
  update public.space_bookings
     set status = 'REJECTED', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = b.id;
end;
$$;

-- The client may withdraw its own request; a manager may also cancel an approved
-- booking. Reserved (still empty) slots go back to FREE.
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare b public.space_bookings;
begin
  select * into b from public.space_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not (public.can_write_warehouse(b.warehouse_id)
          or (public.is_my_client(b.client_id) and b.status = 'REQUESTED')) then
    raise exception 'Not allowed to cancel this booking' using errcode = '42501';
  end if;
  if b.status not in ('REQUESTED', 'APPROVED') then
    raise exception 'Booking is already %', b.status using errcode = 'WMS03';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = 'WMS08';
  end if;
  update public.brigade_slots
     set status = case when status = 'RESERVED' then 'FREE'::public.slot_status else status end,
         reserved_client_id = null, booking_id = null
   where booking_id = b.id;
  update public.space_bookings
     set status = 'CANCELLED', decided_by = auth.uid(), decided_at = now(), decision_note = p_reason
   where id = b.id;
end;
$$;
