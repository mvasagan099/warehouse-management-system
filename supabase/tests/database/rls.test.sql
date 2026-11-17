-- =====================================================================
-- RLS & database-function tests (pgTAP). Run with:  npm run test:db
-- Everything runs in a transaction and is rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(60);

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into public.warehouses (id, code, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'TA', 'Test Warehouse A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'TB', 'Test Warehouse B');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   't-admin@test.local',  '{"role":"SUPER_ADMIN"}', '{"full_name":"T Admin"}'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   't-mgr-a@test.local',  '{"role":"WAREHOUSE_MANAGER"}', '{"full_name":"Manager A"}'),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   't-mgr-b@test.local',  '{"role":"WAREHOUSE_MANAGER"}', '{"full_name":"Manager B"}'),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   't-staff-a@test.local','{"role":"STAFF","warehouse_id":"aaaaaaaa-0000-0000-0000-000000000001"}', '{"full_name":"Staff A"}'),
  ('11111111-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   't-client@test.local', '{}', '{"full_name":"Client"}');

insert into public.warehouse_managers (warehouse_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003');

insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Z1', 'Dry A', 'DRY', null, null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Z1', 'Frozen B', 'FROZEN', -25, -18);

insert into public.vacancies (id, warehouse_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Loader A'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Loader B');
insert into public.applicants (vacancy_id, full_name) values
  ('cccccccc-0000-0000-0000-000000000001', 'Applicant A'),
  ('cccccccc-0000-0000-0000-000000000002', 'Applicant B');

create temp table t_ids as
  select (select id from public.brigade_types where is_default and deleted_at is null) as bt;
grant select on t_ids to authenticated, anon;

-- ---------------------------------------------------------------------
-- Schema-level checks
-- ---------------------------------------------------------------------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every table in public has RLS enabled');

select is((select volume_m3 from public.brigade_types where name = 'Standard Brigade'), 1.728::numeric,
  'Standard Brigade volume is generated as 1.728 m3');

select is(
  (select role::text from public.profiles where id = '11111111-0000-0000-0000-000000000004') || '/' ||
  (select warehouse_id::text from public.profiles where id = '11111111-0000-0000-0000-000000000004'),
  'STAFF/aaaaaaaa-0000-0000-0000-000000000001', 'auth trigger creates profile with role + warehouse from app_metadata');

select is((select role::text from public.profiles where id = '11111111-0000-0000-0000-000000000005'), 'CLIENT',
  'users without an app_metadata role default to CLIENT');

select throws_ok(
  $$ insert into public.zones (warehouse_id, name, storage_type, temp_min, temp_max)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bad dry', 'DRY', 2, 8) $$,
  '23514', null, 'DRY zone cannot have a temperature band');

select throws_ok(
  $$ insert into public.zones (warehouse_id, name, storage_type)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bad frozen', 'FROZEN') $$,
  '23514', null, 'FROZEN zone requires temp_min/temp_max');

-- ---------------------------------------------------------------------
-- SUPER_ADMIN
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 5, 4, 5, 1), 100,
  'admin bulk-creates 100 slots (5 aisles x 4 racks x 5 levels)');
select is(
  (select code from public.brigade_slots
   where zone_id = 'bbbbbbbb-0000-0000-0000-000000000001' and aisle = 3 and rack = 4 and level = 2 and position = 1),
  'TA-Z1-A3-R4-L2-B01', 'slot code follows W-Z-A-R-L-B format');
select is(public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 5, 4, 5, 1), 0,
  're-running the builder skips existing positions');
select is(public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000002', (select bt from t_ids), 2, 2, 3, 1), 12,
  'admin creates slots in another warehouse');
select throws_ok(
  $$ select public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 0, 1, 1, 1) $$,
  '22023', null, 'builder rejects zero dimensions');
select is((select count(*)::int from public.warehouses
           where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')), 2,
  'admin sees all warehouses');
select ok(exists(select 1 from public.audit_logs
                 where table_name = 'brigade_slots' and action = 'INSERT'
                   and changed_by = '11111111-0000-0000-0000-000000000001'
                   and warehouse_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'audit log records who inserted slots');
update public.zones set name = 'Dry A (renamed)' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select ok(exists(select 1 from public.audit_logs
                 where table_name = 'zones' and action = 'UPDATE'
                   and record_id = 'bbbbbbbb-0000-0000-0000-000000000001'
                   and old_data ->> 'name' = 'Dry A' and new_data ->> 'name' = 'Dry A (renamed)'),
  'audit log keeps old and new row as JSON');

-- ---------------------------------------------------------------------
-- WAREHOUSE_MANAGER of A
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}', true);

select results_eq('select id from public.warehouses',
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$, 'manager sees only their warehouse');
select is((select count(*)::int from public.zones where warehouse_id <> 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'manager sees no zones of other warehouses');
select is((select count(*)::int from public.brigade_slots where warehouse_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'manager sees no slots of other warehouses');
select results_eq('select distinct warehouse_id from public.v_zone_slot_summary',
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$, 'manager dashboard view is scoped to their warehouse');
select is((select sum(total_slots)::int from public.v_zone_slot_summary), 100, 'manager dashboard counts 100 slots');
select throws_ok(
  $$ insert into public.zones (warehouse_id, name, storage_type) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Sneaky', 'DRY') $$,
  '42501', null, 'manager cannot create a zone in another warehouse');
select is_empty(
  $$ update public.zones set name = 'hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id $$,
  'manager cannot edit a zone of another warehouse');
select is_empty(
  $$ delete from public.brigade_slots where warehouse_id = 'aaaaaaaa-0000-0000-0000-000000000002' returning id $$,
  'manager cannot delete slots of another warehouse');
select throws_ok(
  $$ update public.zones set warehouse_id = 'aaaaaaaa-0000-0000-0000-000000000002' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '42501', null, 'manager cannot move their zone into another warehouse');
select throws_ok(
  $$ select public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000002', (select bt from t_ids), 1, 1, 1, 1) $$,
  'P0002', null, 'manager cannot build slots in another warehouse''s zone');
select is(public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 1, 1, 1, 1, 6), 1,
  'manager can extend the layout of their own zone');
select isnt_empty(
  $$ update public.zones set notes = 'checked' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id $$,
  'manager can edit their own zone');
select is_empty('select id from public.audit_logs', 'manager cannot read the audit log');
select throws_ok(
  $$ update public.profiles set role = 'SUPER_ADMIN' where id = '11111111-0000-0000-0000-000000000002' $$,
  '42501', null, 'manager cannot escalate their own role');
select is((select count(*)::int from public.profiles where id = '11111111-0000-0000-0000-000000000004'), 1,
  'manager can see staff of their warehouse');
select is_empty($$ select id from public.profiles where id = '11111111-0000-0000-0000-000000000003' $$,
  'manager cannot see other managers');
select throws_ok(
  $$ insert into public.warehouse_managers (warehouse_id, user_id)
     values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002') $$,
  '42501', null, 'manager cannot assign themselves to another warehouse');
select is_empty($$ update public.brigade_types set length_m = 2 returning id $$,
  'manager cannot edit brigade types');
select results_eq('select id from public.vacancies',
  $$ values ('cccccccc-0000-0000-0000-000000000001'::uuid) $$, 'manager sees only their warehouse vacancies');
select is((select count(*)::int from public.applicants), 1, 'manager sees only their warehouse applicants');

-- manager B cannot see A
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is_empty($$ select id from public.warehouses where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'manager B cannot read warehouse A');

-- ---------------------------------------------------------------------
-- STAFF of A (read-only)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}', true);

select is((select count(*)::int from public.brigade_slots), 101, 'staff can read slots of their warehouse');
select is_empty($$ select id from public.warehouses where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  'staff cannot read another warehouse');
select throws_ok(
  $$ insert into public.zones (warehouse_id, name, storage_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Staff zone', 'DRY') $$,
  '42501', null, 'staff cannot create zones');
select is_empty($$ update public.brigade_slots set status = 'BLOCKED' returning id $$, 'staff cannot update slots');
select is_empty($$ delete from public.brigade_slots returning id $$, 'staff cannot delete slots');
select is_empty($$ update public.warehouses set name = 'x' returning id $$, 'staff cannot update their warehouse');
select throws_ok(
  $$ select public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 1, 1, 1, 1, 9) $$,
  '42501', null, 'staff cannot run the slot builder');
select is_empty('select id from public.vacancies', 'staff cannot see hiring data');
select throws_ok(
  $$ update public.profiles set is_active = true, role = 'WAREHOUSE_MANAGER' where id = '11111111-0000-0000-0000-000000000004' $$,
  '42501', null, 'staff cannot change their own role');

-- ---------------------------------------------------------------------
-- CLIENT: no access to Phase 1 tables
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000005","role":"authenticated"}', true);

select is_empty('select id from public.warehouses',          'client sees no warehouses');
select is_empty('select id from public.zones',               'client sees no zones');
select is_empty('select id from public.brigade_slots',       'client sees no slots');
select is_empty('select id from public.brigade_types',       'client sees no brigade types');
select is_empty('select zone_id from public.v_zone_slot_summary', 'client dashboard view is empty');
select is_empty('select id from public.audit_logs',          'client sees no audit logs');
select is_empty('select id from public.warehouse_managers',  'client sees no manager assignments');
select results_eq('select id from public.profiles',
  $$ values ('11111111-0000-0000-0000-000000000005'::uuid) $$, 'client sees only their own profile');

-- ---------------------------------------------------------------------
-- anon: nothing at all
-- ---------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select id from public.warehouses',     '42501', null, 'anon cannot read warehouses');
select throws_ok('select id from public.profiles',       '42501', null, 'anon cannot read profiles');
select throws_ok('select id from public.brigade_slots',  '42501', null, 'anon cannot read slots');
select throws_ok('select id from public.audit_logs',     '42501', null, 'anon cannot read audit logs');
select throws_ok('select zone_id from public.v_zone_slot_summary', '42501', null, 'anon cannot read dashboard view');
select throws_ok(
  $$ select public.create_brigade_slots('bbbbbbbb-0000-0000-0000-000000000001', (select bt from t_ids), 1, 1, 1, 1) $$,
  '42501', null, 'anon cannot run the slot builder');

-- ---------------------------------------------------------------------
-- Verify nothing leaked through (as postgres)
-- ---------------------------------------------------------------------
reset role;
select is((select name from public.zones where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Frozen B',
  'zone of warehouse B is unchanged after the attack attempts');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"WAREHOUSE_MANAGER"}'
  where id = '11111111-0000-0000-0000-000000000005';
select is((select role::text from public.profiles where id = '11111111-0000-0000-0000-000000000005'), 'WAREHOUSE_MANAGER',
  'role set later in app_metadata (admin createUser flow) is synced to profiles');

select * from finish();
rollback;
