-- =====================================================================
-- Phase 2: lorry / gate entries (both directions), load lines, photo storage.
-- =====================================================================

create table public.gate_entries (
  id                     uuid primary key default gen_random_uuid(),
  gate_pass_no           text unique,
  warehouse_id           uuid not null references public.warehouses(id),
  direction              public.gate_direction not null,
  status                 public.gate_status not null default 'AT_GATE',
  client_id              uuid not null references public.clients(id),
  company_id             uuid references public.company_master(id),   -- from company (inward) / to company (outward)
  lorry_number           text not null check (lorry_number ~ '^[A-Z0-9]{4,12}$'),
  lorry_type             text,
  capacity_tonnes        numeric(8,2) check (capacity_tonnes is null or capacity_tonnes > 0),
  driver_name            text,
  driver_phone           text,
  driver_licence_no      text,
  transporter_name       text,
  lr_number              text,
  invoice_number         text,
  eway_bill_number       text check (eway_bill_number is null or eway_bill_number ~ '^[0-9]{12}$'),
  eway_valid_until       timestamptz,
  seal_number_arrival    text,
  seal_number_departure  text,
  gate_in_at             timestamptz not null default now(),
  unloading_start_at     timestamptz,
  unloading_end_at       timestamptz,
  loading_start_at       timestamptz,
  loading_end_at         timestamptz,
  gate_out_at            timestamptz,
  lorry_temp_c           numeric(5,2),
  photos                 text[] not null default '{}',   -- storage paths in bucket gate-photos
  dispatch_request_id    uuid,                           -- outward: set by confirm_delivery_challan
  remarks                text,
  cancel_reason          text,
  cancelled_by           uuid,
  cancelled_at           timestamptz,
  created_by             uuid default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create index gate_entries_warehouse_idx on public.gate_entries (warehouse_id);
create index gate_entries_client_idx    on public.gate_entries (client_id);
create index gate_entries_status_idx    on public.gate_entries (status);
create index gate_entries_direction_idx on public.gate_entries (direction);

create table public.gate_entry_lines (
  id               uuid primary key default gen_random_uuid(),
  gate_entry_id    uuid not null references public.gate_entries(id),
  warehouse_id     uuid not null references public.warehouses(id),   -- copied from gate entry
  client_id        uuid not null references public.clients(id),      -- copied from gate entry
  line_no          integer not null,
  item_name        text not null check (length(trim(item_name)) > 0),
  sku              text,
  batch_no         text,
  mfg_date         date,
  expiry_date      date,
  packages         integer not null default 0 check (packages >= 0),
  unit             text not null default 'BOX',
  declared_qty     numeric(14,3) not null check (declared_qty > 0),
  weight_kg        numeric(12,3) not null default 0 check (weight_kg >= 0),
  storage_type     public.storage_type,
  required_temp_c  numeric(5,2),
  counted_qty      numeric(14,3) check (counted_qty is null or counted_qty >= 0),
  accepted_qty     numeric(14,3) check (accepted_qty is null or accepted_qty >= 0),
  short_qty        numeric(14,3) not null default 0 check (short_qty >= 0),
  damaged_qty      numeric(14,3) not null default 0 check (damaged_qty >= 0),
  condition        public.line_condition,
  remarks          text,
  photo_path       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint gate_line_requirement check (storage_type is not null or required_temp_c is not null),
  constraint gate_line_dates check (mfg_date is null or expiry_date is null or expiry_date >= mfg_date),
  constraint gate_line_no_uq unique (gate_entry_id, line_no)
);
create index gate_entry_lines_entry_idx     on public.gate_entry_lines (gate_entry_id);
create index gate_entry_lines_warehouse_idx on public.gate_entry_lines (warehouse_id);
create index gate_entry_lines_client_idx    on public.gate_entry_lines (client_id);

-- ---------- triggers ----------
create or replace function public.gate_entries_normalise()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.lorry_number := upper(regexp_replace(coalesce(new.lorry_number, ''), '[^A-Za-z0-9]', '', 'g'));
  new.eway_bill_number := nullif(regexp_replace(coalesce(new.eway_bill_number, ''), '\s', '', 'g'), '');
  return new;
end;
$$;

-- Status workflow for API users. RECEIVED / DISPATCHED are only set by the
-- confirm functions; cancelling needs a manager and a reason.
create or replace function public.gate_entries_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'AT_GATE';
    new.dispatch_request_id := null;
    new.cancel_reason := null; new.cancelled_by := null; new.cancelled_at := null;
    new.gate_pass_no := null;
    new.created_by := auth.uid();
    if not public.client_has_active_contract(new.client_id, new.warehouse_id, public.today_ist()) then
      raise exception 'Client has no active contract with this warehouse' using errcode = 'WMS14';
    end if;
  else
    if new.warehouse_id is distinct from old.warehouse_id or new.direction is distinct from old.direction
       or new.client_id is distinct from old.client_id or new.gate_pass_no is distinct from old.gate_pass_no
       or new.dispatch_request_id is distinct from old.dispatch_request_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Warehouse, direction, client and gate pass number cannot change' using errcode = '42501';
    end if;
    if old.status = 'CANCELLED' then
      raise exception 'A cancelled gate entry cannot be edited' using errcode = 'WMS03';
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        if not public.can_write_warehouse(old.warehouse_id) then
          raise exception 'Only a manager can cancel a gate entry' using errcode = '42501';
        end if;
        if coalesce(trim(new.cancel_reason), '') = '' then
          raise exception 'A cancellation reason is required' using errcode = 'WMS08';
        end if;
        if old.status in ('RECEIVED', 'DISPATCHED') then
          raise exception 'Cancel the receipt or challan instead' using errcode = 'WMS03';
        end if;
        new.cancelled_by := auth.uid();
        new.cancelled_at := now();
      elsif old.direction = 'INWARD' and old.status = 'AT_GATE' and new.status = 'UNLOADING' then
        new.unloading_start_at := coalesce(new.unloading_start_at, now());
      elsif old.direction = 'OUTWARD' and old.status = 'AT_GATE' and new.status = 'LOADING' then
        new.loading_start_at := coalesce(new.loading_start_at, now());
      else
        raise exception 'Gate entry cannot move from % to %', old.status, new.status using errcode = 'WMS03';
      end if;
    elsif new.cancel_reason is distinct from old.cancel_reason
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'Cancellation fields change only when cancelling' using errcode = '42501';
    end if;
  end if;

  if new.company_id is not null and (tg_op = 'INSERT' or new.company_id is distinct from old.company_id) then
    if not public.company_belongs_to_client(new.company_id, new.client_id) then
      raise exception 'Company does not belong to this client' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger a_gate_entries_normalise before insert or update on public.gate_entries
  for each row execute function public.gate_entries_normalise();
create trigger b_gate_entries_guard before insert or update on public.gate_entries
  for each row execute function public.gate_entries_guard();
create trigger c_gate_entries_number before insert on public.gate_entries
  for each row execute function public.assign_doc_number('GP', 'gate_pass_no');
create trigger set_updated_at before update on public.gate_entries
  for each row execute function public.set_updated_at();

-- lines: copy warehouse/client from the entry, number lines, and only allow
-- edits while an INWARD entry is still at the gate or unloading.
create or replace function public.gate_entry_lines_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare g public.gate_entries;
begin
  select * into g from public.gate_entries where id = new.gate_entry_id;
  if not found then
    raise exception 'Gate entry not found' using errcode = '23503';
  end if;
  new.warehouse_id := g.warehouse_id;
  new.client_id := g.client_id;
  if tg_op = 'INSERT' and new.line_no is null then
    select coalesce(max(line_no), 0) + 1 into new.line_no
    from public.gate_entry_lines where gate_entry_id = new.gate_entry_id;
  end if;
  return new;
end;
$$;

create or replace function public.gate_entry_lines_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare v_status public.gate_status; v_dir public.gate_direction;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.gate_entry_id is distinct from old.gate_entry_id then
    raise exception 'A line cannot move to another gate entry' using errcode = '42501';
  end if;
  select g.status, g.direction into v_status, v_dir from public.gate_entries g where g.id = new.gate_entry_id;
  if v_dir <> 'INWARD' or v_status not in ('AT_GATE', 'UNLOADING') then
    raise exception 'Load lines can only change while an inward lorry is at the gate or unloading' using errcode = 'WMS03';
  end if;
  return new;
end;
$$;

create trigger a_gate_entry_lines_sync before insert or update on public.gate_entry_lines
  for each row execute function public.gate_entry_lines_sync();
create trigger b_gate_entry_lines_guard before insert or update on public.gate_entry_lines
  for each row execute function public.gate_entry_lines_guard();
create trigger set_updated_at before update on public.gate_entry_lines
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.gate_entries     enable row level security;
alter table public.gate_entry_lines enable row level security;

create policy gate_entries_select on public.gate_entries for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy gate_entries_insert on public.gate_entries for insert to authenticated
  with check (public.can_operate_warehouse(warehouse_id));
create policy gate_entries_update on public.gate_entries for update to authenticated
  using (public.can_operate_warehouse(warehouse_id)) with check (public.can_operate_warehouse(warehouse_id));

create policy gate_entry_lines_select on public.gate_entry_lines for select to authenticated
  using (public.can_view_row(warehouse_id, client_id));
create policy gate_entry_lines_insert on public.gate_entry_lines for insert to authenticated
  with check (public.can_operate_warehouse(warehouse_id));
create policy gate_entry_lines_update on public.gate_entry_lines for update to authenticated
  using (public.can_operate_warehouse(warehouse_id)) with check (public.can_operate_warehouse(warehouse_id));

-- ---------- Storage: private buckets, first path segment = warehouse id ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gate-photos', 'gate-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('signatures',  'signatures',  false, 1048576,  array['image/png'])
on conflict (id) do nothing;

create or replace function public.path_warehouse_id(p_name text)
returns uuid language sql immutable set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;

create policy wms_gate_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gate-photos' and public.can_operate_warehouse(public.path_warehouse_id(name)));
create policy wms_gate_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'gate-photos' and public.can_read_warehouse(public.path_warehouse_id(name)));
create policy wms_signatures_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'signatures' and public.can_operate_warehouse(public.path_warehouse_id(name)));
-- signature read policy for clients is added with delivery_challans (dispatch migration)
