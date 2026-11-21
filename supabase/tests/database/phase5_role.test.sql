begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);
insert into public.warehouses (id, code, name) values ('a9000000-0000-0000-0000-000000000001', 'RL', 'Role Hub');
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('a9000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-admin@test.local', '{"role":"SUPER_ADMIN"}'),
  ('a9000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-staff@test.local', '{"role":"STAFF","warehouse_id":"a9000000-0000-0000-0000-000000000001"}');
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select throws_ok($$ select public.change_login_role('a9000000-0000-0000-0000-0000000000f4', 'WAREHOUSE_MANAGER') $$, 'WMS03', null, 'staff cannot promote themselves');
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select lives_ok($$ select public.change_login_role('a9000000-0000-0000-0000-0000000000f4', 'WAREHOUSE_MANAGER') $$, 'the administrator promotes staff to manager');
select is((select role::text from public.profiles where id = 'a9000000-0000-0000-0000-0000000000f4'), 'WAREHOUSE_MANAGER', 'the login role is now manager');
select is((select count(*)::int from public.warehouse_managers where user_id = 'a9000000-0000-0000-0000-0000000000f4' and warehouse_id = 'a9000000-0000-0000-0000-000000000001' and deleted_at is null), 1, 'and they manage their warehouse');
select is((select job_role::text from public.employees where user_id = 'a9000000-0000-0000-0000-0000000000f4'), 'MANAGER', 'the staff record says manager');
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select is(public.manages_warehouse('a9000000-0000-0000-0000-000000000001'), true, 'they now have manager access');
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select lives_ok($$ select public.change_login_role('a9000000-0000-0000-0000-0000000000f4', 'STAFF') $$, 'and can be switched back');
select is((select role::text || ',' || warehouse_id::text from public.profiles where id = 'a9000000-0000-0000-0000-0000000000f4'), 'STAFF,a9000000-0000-0000-0000-000000000001', 'staff again, with the warehouse');
select throws_ok($$ select public.change_login_role('a9000000-0000-0000-0000-0000000000f1', 'STAFF') $$, 'WMS51', null, 'the administrator cannot change their own role');
select * from finish();
rollback;
