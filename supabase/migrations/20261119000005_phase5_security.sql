-- =====================================================================
-- Phase 5 / 4: security hardening.
--   * two-factor sign-in for SUPER_ADMIN (switchable; cannot be switched on from a session that has not passed the second factor)
--   * least privilege: no table privilege without a policy that could use it
--   * tighter ticket attachment access
-- =====================================================================

-- ---------- optional two-factor sign-in for the administrator ----------
create or replace function public.mfa_required() returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select (value ->> 'require_admin_mfa')::boolean from public.app_settings where key = 'security'), false) $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'SUPER_ADMIN', false)
     and (auth.uid() is null or not public.mfa_required() or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
$$;

-- the one place a session may read its own two-factor state (the app uses it to show the enrolment or challenge screen)
create or replace function public.my_security_state() returns jsonb language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('mfa_required', public.mfa_required() and public.current_app_role() = 'SUPER_ADMIN', 'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'), 'role', public.current_app_role()) $$;

create or replace function public.set_require_admin_mfa(p_on boolean) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'SUPER_ADMIN' then raise exception 'Only an administrator can change this' using errcode = 'WMS03'; end if;
  if p_on and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Sign in with your second factor first, then switch this on (otherwise you could lock yourself out)' using errcode = 'WMS60'; end if;
  insert into public.app_settings (key, value, description) values ('security', jsonb_build_object('require_admin_mfa', p_on), 'Require two-factor sign-in for SUPER_ADMIN')
  on conflict (key) do update set value = jsonb_build_object('require_admin_mfa', p_on), updated_at = now();
end $$;

-- ---------- least privilege: remove table privileges that no policy can ever use ----------
do $$
declare r record;
begin
  for r in
    select c.relname, ops.op
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('insert', 'INSERT'), ('update', 'UPDATE'), ('delete', 'DELETE'), ('select', 'SELECT')) ops(op, cmd)
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition and has_table_privilege('authenticated', c.oid, ops.op)
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in (ops.cmd, 'ALL'))
  loop
    execute format('revoke %s on public.%I from authenticated', r.op, r.relname);
  end loop;
end $$;

-- ---------- ticket attachments: a manager only reaches clients with a ticket at one of their warehouses ----------
drop policy if exists wms_tickets_insert on storage.objects;
drop policy if exists wms_tickets_select on storage.objects;
create or replace function public.ticket_object_allowed(p_name text) returns boolean language sql stable security definer set search_path = ''
as $$
  select (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$' and (
    public.is_my_client(((storage.foldername(p_name))[1])::uuid) or public.is_admin()
    or exists (select 1 from public.support_tickets t where t.client_id = ((storage.foldername(p_name))[1])::uuid and t.warehouse_id is not null and public.manages_warehouse(t.warehouse_id)))
$$;
create policy wms_tickets_insert on storage.objects for insert to authenticated with check (bucket_id = 'tickets' and public.ticket_object_allowed(name));
create policy wms_tickets_select on storage.objects for select to authenticated using (bucket_id = 'tickets' and public.ticket_object_allowed(name));

revoke execute on all functions in schema public from anon, public;

-- ---------- backups bucket: the administrator can list and download the nightly exports (nobody else; written only by the Edge Function) ----------
create policy wms_backups_select on storage.objects for select to authenticated using (bucket_id = 'backups' and public.is_admin());
