-- Inward advice: client tells the warehouse what is coming; staff mark it arrived and the gate entry is made from it.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);
insert into public.warehouses (id, code, name) values ('a8000000-0000-0000-0000-000000000001', 'AD', 'Advice Hub');
insert into public.clients (id, code, company_name) values ('c8000000-0000-0000-0000-000000000001', 'AC1', 'Advice One'), ('c8000000-0000-0000-0000-000000000002', 'AC2', 'Advice Two');
insert into public.company_master (id, client_id, name) values ('e8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 'Sender Co');
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('a8000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ad-staff@test.local', '{"role":"STAFF","warehouse_id":"a8000000-0000-0000-0000-000000000001"}'),
  ('a8000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ad-c1@test.local', '{"role":"CLIENT","client_id":"c8000000-0000-0000-0000-000000000001"}'),
  ('a8000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ad-c2@test.local', '{"role":"CLIENT","client_id":"c8000000-0000-0000-0000-000000000002"}');
create temp table t8 (k text primary key, v text); grant all on t8 to authenticated;

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
insert into t8 select 'adv', public.create_inward_advice('a8000000-0000-0000-0000-000000000001', public.today_ist(), 'e8000000-0000-0000-0000-000000000001', 'tn 01 ab 1234', 'Ravi', '9000000000', null,
  '[{"item_name":"Frozen peas","quantity":100,"unit":"BOX","storage_type":"FROZEN","required_temp_c":-20}]'::jsonb);
select is((select status from public.inward_advices where id = (select v::uuid from t8 where k = 'adv')), 'ADVISED', 'a client creates an advice');
select is((select lorry_number from public.inward_advices where id = (select v::uuid from t8 where k = 'adv')), 'TN01AB1234', 'the lorry number is tidied up');
select throws_ok($$ select public.create_inward_advice('a8000000-0000-0000-0000-000000000001', public.today_ist(), null, null, null, null, null, '[]'::jsonb) $$, 'WMS08', null, 'an advice needs at least one item');
select throws_ok($$ select public.create_inward_advice('a8000000-0000-0000-0000-000000000001', public.today_ist() - 5, null, null, null, null, null, '[{"item_name":"x","quantity":1}]'::jsonb) $$, 'WMS08', null, 'a date in the past is refused');
select throws_ok($$ select public.mark_advice_arrived((select v::uuid from t8 where k = 'adv')) $$, 'WMS03', null, 'a client cannot mark their own advice as arrived');
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000f6","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*)::int from public.inward_advices), 0, 'another client cannot see it');
reset role;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select is((select count(*)::int from public.inward_advices), 1, 'warehouse staff see the expected consignment');
insert into t8 select 'gate', public.mark_advice_arrived((select v::uuid from t8 where k = 'adv'));
select is((select count(*)::int from public.gate_entry_lines where gate_entry_id = (select v::uuid from t8 where k = 'gate') and declared_qty = 100), 1, 'the gate entry is made with the advised goods');
select is((select status from public.inward_advices where id = (select v::uuid from t8 where k = 'adv')), 'ARRIVED', 'the advice is marked arrived');
select throws_ok($$ select public.mark_advice_arrived((select v::uuid from t8 where k = 'adv')) $$, 'WMS03', null, 'it cannot arrive twice');
select is((select lorry_number from public.gate_entries where id = (select v::uuid from t8 where k = 'gate')), 'TN01AB1234', 'the lorry number came across');
select * from finish();
rollback;
