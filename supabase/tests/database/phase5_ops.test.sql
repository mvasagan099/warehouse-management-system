-- Phase 5 database tests: client portal (tickets, change requests, notices), dashboards, imports, cron health, rate limits, retention.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(60);

insert into public.warehouses (id, code, name) values ('a6000000-0000-0000-0000-000000000001', 'O1', 'Ops Hub'), ('a6000000-0000-0000-0000-000000000002', 'O2', 'Ops Other');
insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values
  ('d6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Z1', 'Freezer', 'FROZEN', -25, -18);
insert into public.brigade_slots (id, warehouse_id, zone_id, brigade_type_id, aisle, rack, level, position, code) values
  ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', (select id from public.brigade_types where is_default), 1, 1, 1, 1, 'O1-SLOT-1'),
  ('b6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', (select id from public.brigade_types where is_default), 1, 1, 1, 2, 'O1-SLOT-2');
insert into public.clients (id, code, company_name, email) values
  ('c6000000-0000-0000-0000-000000000001', 'CT1', 'Client Alpha', 'alpha@test.local'), ('c6000000-0000-0000-0000-000000000002', 'CT2', 'Client Beta', 'beta@test.local');
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('a6000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-admin@test.local', '{"role":"SUPER_ADMIN"}'),
  ('a6000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-mgr@test.local', '{"role":"WAREHOUSE_MANAGER"}'),
  ('a6000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-staff@test.local', '{"role":"STAFF","warehouse_id":"a6000000-0000-0000-0000-000000000001"}'),
  ('a6000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-c1@test.local', '{"role":"CLIENT","client_id":"c6000000-0000-0000-0000-000000000001"}'),
  ('a6000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-c2@test.local', '{"role":"CLIENT","client_id":"c6000000-0000-0000-0000-000000000002"}'),
  ('a6000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-acct@test.local', '{"role":"ACCOUNTANT"}');
insert into public.warehouse_managers (warehouse_id, user_id) values ('a6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-0000000000f3');
create temp table t6 (k text primary key, v text); grant all on t6 to authenticated;

-- A. tickets
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
insert into t6 select 'tk', public.open_ticket('Missing pallet', 'One pallet is missing from my last dispatch', 'a6000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.ticket_events where ticket_id = (select v::uuid from t6 where k = 'tk')), 2, 'a ticket starts with a message and an OPEN status event');
select throws_ok($$ select public.open_ticket('Hi', '') $$, 'WMS08', null, 'a ticket needs a description');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f6","role":"authenticated"}', false);
select throws_ok($$ select public.reply_ticket((select v::uuid from t6 where k = 'tk'), 'hello') $$, 'WMS03', null, 'another client cannot reply to it');
set local role authenticated;
select is((select count(*)::int from public.support_tickets), 0, 'another client cannot see the ticket');
select is((select count(*)::int from public.ticket_events), 0, 'or its messages');
reset role;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
select lives_ok($$ select public.reply_ticket((select v::uuid from t6 where k = 'tk'), 'We are checking the challan') $$, 'the warehouse manager replies');
select is((select status::text from public.support_tickets where id = (select v::uuid from t6 where k = 'tk')), 'IN_PROGRESS', 'a staff reply moves OPEN to IN_PROGRESS');
select is((select count(*)::int from public.notifications where user_id = 'a6000000-0000-0000-0000-0000000000f5' and kind = 'TICKET'), 1, 'the client gets a portal notice');
select lives_ok($$ select public.set_ticket_status((select v::uuid from t6 where k = 'tk'), 'RESOLVED', 'Found it') $$, 'manager resolves');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
select throws_ok($$ select public.set_ticket_status((select v::uuid from t6 where k = 'tk'), 'IN_PROGRESS') $$, 'WMS03', null, 'a client can only close a ticket');
select lives_ok($$ select public.reply_ticket((select v::uuid from t6 where k = 'tk'), 'Still not received') $$, 'the client reopens by replying');
select is((select status::text from public.support_tickets where id = (select v::uuid from t6 where k = 'tk')), 'OPEN', 'status goes back to OPEN');
select is((select count(*)::int from public.ticket_events where ticket_id = (select v::uuid from t6 where k = 'tk') and kind = 'STATUS'), 4, 'the status trail has every change');

-- B. profile / GSTIN change requests
insert into t6 select 'cr', public.request_client_change('{"phone": "9876543210", "city": "Madurai"}'::jsonb);
select throws_ok($$ select public.request_client_change('{"credit_limit_paise": 99999999}'::jsonb) $$, 'WMS08', null, 'a client cannot ask to change the credit limit');
select throws_ok($$ select public.request_client_change('{"gstin": "BADGSTIN"}'::jsonb) $$, 'WMS08', null, 'an invalid GSTIN is refused');
select throws_ok($$ select public.decide_client_change((select v::uuid from t6 where k = 'cr'), true) $$, 'WMS03', null, 'a client cannot approve their own change');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select lives_ok($$ select public.decide_client_change((select v::uuid from t6 where k = 'cr'), true, 'ok') $$, 'admin approves');
select is((select city || ',' || phone from public.clients where id = 'c6000000-0000-0000-0000-000000000001'), 'Madurai,9876543210', 'the approved changes are applied');

-- C. notices for stock received / invoice / payment
select is((select count(*)::int from public.notifications where user_id = 'a6000000-0000-0000-0000-0000000000f5' and kind = 'PROFILE'), 1, 'the client is told about the decision');
insert into public.payments (payment_no, client_id, warehouse_id, amount_paise, method, paid_on) values ('PAY-T1', 'c6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 50000, 'CASH', public.today_ist());
select is((select count(*)::int from public.notifications where user_id = 'a6000000-0000-0000-0000-0000000000f5' and kind = 'PAYMENT'), 1, 'payment received gives an in-app notice');
select is((select count(*)::int from public.notification_outbox where to_address = 'alpha@test.local' and subject like 'Payment received%'), 1, 'and an email');
update public.app_settings set value = jsonb_set(value, '{PAYMENT}', 'false') where key = 'client_notices';
insert into public.payments (payment_no, client_id, warehouse_id, amount_paise, method, paid_on) values ('PAY-T2', 'c6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 50000, 'CASH', public.today_ist());
select is((select count(*)::int from public.notifications where user_id = 'a6000000-0000-0000-0000-0000000000f5' and kind = 'PAYMENT'), 1, 'a kind switched off in settings sends nothing');
select is((select count(*)::int from public.notifications where user_id = 'a6000000-0000-0000-0000-0000000000f6' and kind = 'PAYMENT'), 0, 'other clients are never notified');

-- D. opening balance, imports
select is((select count(*)::int from public.import_rows('clients', '[{"company_name":"Gamma Foods","gstin":"33AABCT1332L1ZL","phone":"9000000001"},{"company_name":"Gamma Foods"}]'::jsonb, true) j), 1, 'import returns a report');
select is((public.import_rows('clients', '[{"company_name":"Gamma Foods","gstin":"33AABCT1332L1ZL"},{"company_name":"Gamma Foods"},{"company_name":""},{"company_name":"Bad Gst","gstin":"12345"}]'::jsonb, true) -> 'errors') #>> '{0,row}', '2', 'duplicate name is reported on its row');
select is(jsonb_array_length(public.import_rows('clients', '[{"company_name":"Gamma Foods","gstin":"33AABCT1332L1ZL"},{"company_name":"Gamma Foods"},{"company_name":""},{"company_name":"Bad Gst","gstin":"12345"}]'::jsonb, true) -> 'errors'), 3, 'three bad rows are reported');
select is((select count(*)::int from public.clients where company_name = 'Gamma Foods'), 0, 'a dry run changes nothing');
select is((public.import_rows('clients', '[{"company_name":"Gamma Foods","gstin":"33AABCT1332L1ZL"},{"company_name":""}]'::jsonb, false) ->> 'imported')::int, 0, 'a real run with any bad row imports nothing');
select is((select count(*)::int from public.clients where company_name = 'Gamma Foods'), 0, 'and nothing is saved');
select is((public.import_rows('clients', '[{"company_name":"Gamma Foods","gstin":"33AABCT1332L1ZL","credit_limit_rupees":"50000"},{"company_name":"Delta Cold"}]'::jsonb, false) ->> 'imported')::int, 2, 'a clean file imports every row');
select is((select credit_limit_paise from public.clients where company_name = 'Gamma Foods'), 5000000::bigint, 'rupees become paise');
select is((public.import_rows('opening_balances', '[{"client_code":"CT1","as_of":"2026-11-01","amount_rupees":"12500.50","notes":"B/F"},{"client_code":"NOPE","as_of":"2026-11-01","amount_rupees":"1"},{"client_code":"CT2","as_of":"01/11/2026","amount_rupees":"1"}]'::jsonb, true) ->> 'valid')::int, 1, 'balances: 1 valid, 2 bad');
select is((public.import_rows('opening_balances', '[{"client_code":"CT1","as_of":"2026-11-01","amount_rupees":"12500.50","notes":"B/F"}]'::jsonb, false) ->> 'imported')::int, 1, 'balance imported');
select is((select balance_paise from public.client_ledger('c6000000-0000-0000-0000-000000000001') where doc_type = 'OPENING_BALANCE'), 1250050::bigint, 'the opening balance shows in the client ledger');
select is((public.import_rows('opening_stock', '[{"client_code":"CT1","slot_code":"O1-SLOT-1","item_name":"Peas","batch_no":"B1","unit":"BOX","quantity":"10","unit_weight_kg":"5","storage_type":"FROZEN","required_temp_c":"-20","expiry_date":"2027-06-30"}]'::jsonb, false) ->> 'imported')::int, 1, 'opening stock imports');
select is((select quantity from public.stock_items where batch_no = 'B1' and client_id = 'c6000000-0000-0000-0000-000000000001'), 10::numeric, 'the stock item exists');
select is((select count(*)::int from public.stock_movements where document_type = 'OPENING_STOCK'), 1, 'and the ledger has its IN movement');
select is((select status::text from public.brigade_slots where code = 'O1-SLOT-1'), 'OCCUPIED', 'the slot is occupied');
select is((public.import_rows('opening_stock', '[{"client_code":"CT2","slot_code":"O1-SLOT-1","item_name":"Fish","unit":"BOX","quantity":"1","unit_weight_kg":"1","storage_type":"FROZEN","required_temp_c":"-20"}]'::jsonb, true) -> 'errors') #>> '{0,message}', 'Slot O1-SLOT-1 holds another client''s goods', 'a slot held by another client is refused');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
select throws_ok($$ select public.import_rows('clients', '[{"company_name":"X"}]'::jsonb) $$, 'WMS03', null, 'only an administrator can import');

-- E. dashboards
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
select is((public.client_dashboard() ->> 'brigades_held')::int, 1, 'client dashboard: brigades held');
select is(jsonb_array_length(public.client_dashboard() -> 'stock_by_band'), 1, 'client dashboard: stock by temperature band');
select is((public.client_dashboard() -> 'open_requests' ->> 'tickets')::int, 1, 'client dashboard: open tickets');
select is((public.client_dashboard() ->> 'outstanding_paise')::bigint, 1250050::bigint, 'client dashboard: outstanding includes the opening balance');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f6","role":"authenticated"}', false);
select is((public.client_dashboard() ->> 'brigades_held')::int, 0, 'another client sees only their own numbers');
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select ok(public.admin_dashboard() ? 'occupancy' and public.admin_dashboard() ? 'cron_warnings', 'admin dashboard has its sections');
select ok(public.manager_dashboard('a6000000-0000-0000-0000-000000000001') ? 'staff_on_shift', 'manager dashboard has its sections');

-- F. cron health, rate limit, retention, hard-delete guard
select public.cron_run('t-ok', 'select 1');
select public.cron_run('t-bad', 'select 1/0');
select is((select last_status from public.cron_job_state where job = 't-bad'), 'FAILED', 'a failing job is recorded as FAILED');
select ok(exists (select 1 from public.cron_health() where job = 't-bad'), 'and appears in the admin warnings');
select ok(not exists (select 1 from public.cron_health() where job = 't-ok'), 'a healthy job does not');
select ok(public.rate_limit_hit('k1', 60, 2) and public.rate_limit_hit('k1', 60, 2) and not public.rate_limit_hit('k1', 60, 2), 'the third hit inside the window is refused');
select throws_ok($$ delete from public.payments $$, 'WMS59', null, 'payments cannot be hard-deleted');
select throws_ok($$ delete from public.opening_balances $$, 'WMS59', null, 'nor opening balances');
select ok((public.cleanup_old_data() ? 'notifications'), 'the clean-up job runs');


-- G. private storage: a client cannot reach another client's files (or HR, backup and cold-chain files)
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
insert into storage.objects (bucket_id, name, owner_id) values
  ('tickets', 'c6000000-0000-0000-0000-000000000001/tk/a.pdf', null), ('tickets', 'c6000000-0000-0000-0000-000000000002/tk/b.pdf', null),
  ('hr', 'resume/a6000000-0000-0000-0000-000000000001/x/cv.pdf', null), ('backups', 'daily/x.json', null),
  ('coldchain', 'a6000000-0000-0000-0000-000000000001/x.jpg', null);
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'tickets'), 1, 'a client sees only their own ticket attachments');
select is((select name from storage.objects where bucket_id = 'tickets'), 'c6000000-0000-0000-0000-000000000001/tk/a.pdf', 'and it is their own file');
select is((select count(*)::int from storage.objects where bucket_id in ('hr', 'backups', 'coldchain')), 0, 'a client sees no HR, backup or cold-chain files');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('tickets', 'c6000000-0000-0000-0000-000000000002/tk/evil.pdf') $$, '42501', null, 'a client cannot upload into another client''s folder');
reset role;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'tickets'), 1, 'a manager sees attachments only of clients who have a ticket at their warehouse');
select is((select count(*)::int from storage.objects where bucket_id in ('backups', 'hr') and name like 'daily%'), 0, 'a manager cannot read backups');
reset role;

select * from finish();
rollback;
