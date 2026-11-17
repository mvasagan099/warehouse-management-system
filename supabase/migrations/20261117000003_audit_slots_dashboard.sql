-- =====================================================================
-- Audit trigger, bulk slot builder, dashboard view.
-- =====================================================================

-- ---------- Generic audit trigger ----------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
  v_wh  uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  -- ignore no-op updates (only updated_at bumped)
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  if tg_table_name = 'warehouses' then
    v_wh := v_id;
  else
    v_wh := nullif(coalesce(v_new ->> 'warehouse_id', v_old ->> 'warehouse_id'), '')::uuid;
  end if;

  insert into public.audit_logs (table_name, record_id, warehouse_id, action, old_data, new_data, changed_by)
  values (tg_table_name, v_id, v_wh, tg_op::public.audit_action, v_old, v_new, auth.uid());

  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['warehouses','profiles','warehouse_managers','zones',
                           'brigade_types','brigade_slots','vacancies','applicants']
  loop
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- ---------- Bulk slot builder ----------
-- Creates aisles x racks x levels x slots_per_level brigade slots in a zone.
-- Codes look like W1-Z2-A3-R4-L2-B07. Existing positions are skipped, so the
-- function is safe to re-run or to extend a layout (use p_aisle_start).
-- SECURITY INVOKER: RLS still applies to the inserts; the explicit check just
-- gives a clear error message.
create or replace function public.create_brigade_slots(
  p_zone_id          uuid,
  p_brigade_type_id  uuid,
  p_aisles           integer,
  p_racks            integer,
  p_levels           integer,
  p_slots_per_level  integer default 1,
  p_aisle_start      integer default 1
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
  v_wh_code      text;
  v_zone_code    text;
  v_total        bigint;
  v_count        integer;
begin
  select z.warehouse_id, w.code, z.code
    into v_warehouse_id, v_wh_code, v_zone_code
  from public.zones z
  join public.warehouses w on w.id = z.warehouse_id
  where z.id = p_zone_id and z.deleted_at is null;

  if v_warehouse_id is null then
    raise exception 'Zone not found' using errcode = 'P0002';
  end if;

  if not public.can_write_warehouse(v_warehouse_id) then
    raise exception 'Not allowed to create slots in this warehouse' using errcode = '42501';
  end if;

  if coalesce(p_aisles, 0) < 1 or coalesce(p_racks, 0) < 1 or coalesce(p_levels, 0) < 1
     or coalesce(p_slots_per_level, 0) < 1 or coalesce(p_aisle_start, 0) < 1 then
    raise exception 'Aisles, racks, levels and slots per level must be at least 1' using errcode = '22023';
  end if;

  v_total := p_aisles::bigint * p_racks * p_levels * p_slots_per_level;
  if v_total > 20000 then
    raise exception 'Too many slots in one request (% > 20000)', v_total using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.brigade_types bt
    where bt.id = p_brigade_type_id and bt.is_active and bt.deleted_at is null
  ) then
    raise exception 'Brigade type not found or inactive' using errcode = 'P0002';
  end if;

  insert into public.brigade_slots (warehouse_id, zone_id, brigade_type_id, aisle, rack, level, position, code)
  select v_warehouse_id, p_zone_id, p_brigade_type_id, a, r, l, s,
         format('%s-%s-A%s-R%s-L%s-B%s', v_wh_code, v_zone_code, a, r, l, lpad(s::text, 2, '0'))
  from generate_series(p_aisle_start, p_aisle_start + p_aisles - 1) as a,
       generate_series(1, p_racks)           as r,
       generate_series(1, p_levels)          as l,
       generate_series(1, p_slots_per_level) as s
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_brigade_slots(uuid, uuid, integer, integer, integer, integer, integer) from anon, public;
grant execute on function public.create_brigade_slots(uuid, uuid, integer, integer, integer, integer, integer) to authenticated;

-- ---------- Dashboard view ----------
-- security_invoker => RLS of the caller applies: admin sees all, manager only theirs,
-- staff only theirs, client nothing.
create view public.v_zone_slot_summary
with (security_invoker = true)
as
select
  w.id            as warehouse_id,
  w.code          as warehouse_code,
  w.name          as warehouse_name,
  z.id            as zone_id,
  z.code          as zone_code,
  z.name          as zone_name,
  z.storage_type  as storage_type,
  z.temp_min,
  z.temp_max,
  count(s.id)::integer                                       as total_slots,
  (count(s.id) filter (where s.status = 'FREE'))::integer     as free_slots,
  (count(s.id) filter (where s.status = 'OCCUPIED'))::integer as occupied_slots,
  (count(s.id) filter (where s.status = 'BLOCKED'))::integer  as blocked_slots
from public.warehouses w
join public.zones z
  on z.warehouse_id = w.id and z.deleted_at is null
left join public.brigade_slots s
  on s.zone_id = z.id and s.deleted_at is null
where w.deleted_at is null
group by w.id, w.code, w.name, z.id, z.code, z.name, z.storage_type, z.temp_min, z.temp_max;

revoke all on public.v_zone_slot_summary from anon;
grant select on public.v_zone_slot_summary to authenticated;
