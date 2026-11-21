-- Promote a staff member to warehouse manager (or back). Changing the "job" on the staff page only changed a label before:
-- the login role and the warehouse assignment stayed the same, so nothing changed for the person. This does the whole change.
create or replace function public.change_login_role(p_user_id uuid, p_new_role public.app_role, p_warehouse_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; wh uuid;
begin
  if not public.is_admin() then raise exception 'Only an administrator can change a login role' using errcode = 'WMS03'; end if;
  if p_new_role not in ('STAFF', 'WAREHOUSE_MANAGER') then raise exception 'Only staff and manager roles can be switched here' using errcode = 'WMS08'; end if;
  select * into p from public.profiles where id = p_user_id and deleted_at is null for update;
  if p.id is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  if p.role not in ('STAFF', 'WAREHOUSE_MANAGER') then raise exception 'This login cannot be switched to staff or manager' using errcode = 'WMS08'; end if;
  if p.id = auth.uid() then raise exception 'You cannot change your own role' using errcode = 'WMS51'; end if;
  wh := coalesce(p_warehouse_id, p.warehouse_id, (select warehouse_id from public.warehouse_managers where user_id = p.id and deleted_at is null limit 1));
  if wh is null then raise exception 'Choose a warehouse' using errcode = 'WMS08'; end if;
  if p_new_role = 'WAREHOUSE_MANAGER' then
    update public.profiles set role = 'WAREHOUSE_MANAGER', warehouse_id = null where id = p.id;
    insert into public.warehouse_managers (warehouse_id, user_id) values (wh, p.id) on conflict (warehouse_id, user_id) where deleted_at is null do nothing;
    update public.employees set job_role = 'MANAGER', warehouse_id = wh where user_id = p.id;
  else
    update public.warehouse_managers set deleted_at = now() where user_id = p.id and deleted_at is null;
    update public.profiles set role = 'STAFF', warehouse_id = wh where id = p.id;
    update public.employees set job_role = case when job_role = 'MANAGER' then 'LOADER'::public.job_role else job_role end, warehouse_id = wh where user_id = p.id;
  end if;
end $$;
revoke execute on all functions in schema public from anon, public;
