-- =====================================================================
-- Phase 2 database tests: clients, booking, gate, inward receipt, stock,
-- dispatch / challan, cancellation, RLS per role. Rolled back at the end.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(114);

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into public.warehouses (id, code, name) values
  ('a2000000-0000-0000-0000-000000000001', 'PA', 'Phase2 A'),
  ('a2000000-0000-0000-0000-000000000002', 'PB', 'Phase2 B');

insert into public.clients (id, company_name, gstin) values
  ('c2000000-0000-0000-0000-000000000001', 'Client One Foods', '33AABCT1332L1ZL'),
  ('c2000000-0000-0000-0000-000000000002', 'Client Two Traders', '33AAACR5055K1ZE'),
  ('c2000000-0000-0000-0000-000000000003', 'Client Three (no contract)', null);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-admin@test.local',  '{"role":"SUPER_ADMIN"}'),
  ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-mgr-a@test.local',  '{"role":"WAREHOUSE_MANAGER"}'),
  ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-staff-a@test.local','{"role":"STAFF","warehouse_id":"a2000000-0000-0000-0000-000000000001"}'),
  ('12000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-client1@test.local','{"role":"CLIENT","client_id":"c2000000-0000-0000-0000-000000000001"}'),
  ('12000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-client2@test.local','{"role":"CLIENT","client_id":"c2000000-0000-0000-0000-000000000002"}');

insert into public.warehouse_managers (warehouse_id, user_id) values
  ('a2000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002');

insert into public.contracts (client_id, warehouse_id, start_date, status) values
  ('c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', current_date - 10, 'ACTIVE'),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', current_date - 10, 'ACTIVE'),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', current_date - 10, 'ACTIVE');

insert into public.company_master (id, client_id, kind, name) values
  ('b2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'SENDER',   'Sender Farms'),
  ('b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'RECEIVER', 'Receiver Mart'),
  ('b2000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000002', 'RECEIVER', 'Client2 Shop');

insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values
  ('d2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Z1', 'Dry',     'DRY',     null, null),
  ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'Z2', 'Frozen',  'FROZEN',  -25,  -15),
  ('d2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'Z3', 'Chiller', 'CHILLED', 2,    8),
  ('d2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'Z1', 'Frozen B','FROZEN',  -25,  -15);

-- slots: Z1 x4, Z2 x6, Z3 x2, B-Z1 x2 (standard 1000 kg brigades)
insert into public.brigade_slots (id, zone_id, warehouse_id, brigade_type_id, aisle, rack, level, position, code)
select ('e2000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, z, 'a2000000-0000-0000-0000-000000000001',
       (select id from public.brigade_types where is_default), 1, 1, 1, p, c
from (values
  (11, 'd2000000-0000-0000-0000-000000000001'::uuid, 1, 'PA-Z1-A1-R1-L1-B01'), (12, 'd2000000-0000-0000-0000-000000000001'::uuid, 2, 'PA-Z1-A1-R1-L1-B02'),
  (13, 'd2000000-0000-0000-0000-000000000001'::uuid, 3, 'PA-Z1-A1-R1-L1-B03'), (14, 'd2000000-0000-0000-0000-000000000001'::uuid, 4, 'PA-Z1-A1-R1-L1-B04'),
  (21, 'd2000000-0000-0000-0000-000000000002'::uuid, 1, 'PA-Z2-A1-R1-L1-B01'), (22, 'd2000000-0000-0000-0000-000000000002'::uuid, 2, 'PA-Z2-A1-R1-L1-B02'),
  (23, 'd2000000-0000-0000-0000-000000000002'::uuid, 3, 'PA-Z2-A1-R1-L1-B03'), (24, 'd2000000-0000-0000-0000-000000000002'::uuid, 4, 'PA-Z2-A1-R1-L1-B04'),
  (25, 'd2000000-0000-0000-0000-000000000002'::uuid, 5, 'PA-Z2-A1-R1-L1-B05'), (26, 'd2000000-0000-0000-0000-000000000002'::uuid, 6, 'PA-Z2-A1-R1-L1-B06'),
  (31, 'd2000000-0000-0000-0000-000000000003'::uuid, 1, 'PA-Z3-A1-R1-L1-B01'), (32, 'd2000000-0000-0000-0000-000000000003'::uuid, 2, 'PA-Z3-A1-R1-L1-B02'),
  (41, 'd2000000-0000-0000-0000-000000000004'::uuid, 1, 'PB-Z1-A1-R1-L1-B01'), (42, 'd2000000-0000-0000-0000-000000000004'::uuid, 2, 'PB-Z1-A1-R1-L1-B02')
) v(n, z, p, c);

create temp table t_ids (k text primary key, v uuid);
grant select, insert, update on t_ids to authenticated;
create temp table t_fy as select public.financial_year_label(public.today_ist()) as fy;
grant select on t_fy to authenticated, anon;

-- ---------------------------------------------------------------------
-- A. Validation helpers
-- ---------------------------------------------------------------------
select ok(public.is_valid_gstin('27AAPFU0939F1ZV'), 'valid GSTIN passes the checksum');
select ok(not public.is_valid_gstin('27AAPFU0939F1ZX'), 'GSTIN with a wrong check character fails');
select throws_ok($$ insert into public.clients (company_name, gstin) values ('Bad', '33ABCDE1234F1Z9') $$,
  '23514', null, 'clients reject an invalid GSTIN');
select is((select state_code || '|' || pan || '|' || state from public.clients where id = 'c2000000-0000-0000-0000-000000000001'),
  '33|AABCT1332L|Tamil Nadu', 'state code, state and PAN are derived from the GSTIN');
select is(public.financial_year_label('2027-03-31'), '2627', 'March belongs to the previous financial year');
select is(public.financial_year_label('2027-04-01'), '2728', 'April starts a new financial year');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'every table (including Phase 2) has RLS enabled');

insert into public.warehouses (id, code, name) values ('a2000000-0000-0000-0000-000000000009', 'W99', 'Long code');
select is(public.next_doc_number('a2000000-0000-0000-0000-000000000009', 'DC'),
  'DC/W99/' || (select fy from t_fy) || '/0001', 'challan number format DC/<wh>/<fy>/0001');
select is(length(public.next_doc_number('a2000000-0000-0000-0000-000000000009', 'GRN')), 16,
  'a 3-character warehouse code still gives a 16-character receipt number');

-- ---------------------------------------------------------------------
-- B. Client masters & RLS
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select results_eq('select id from public.clients', $$ values ('c2000000-0000-0000-0000-000000000001'::uuid) $$,
  'a client login sees only its own client record');
select is_empty($$ select id from public.company_master where client_id = 'c2000000-0000-0000-0000-000000000002' $$,
  'client 1 cannot see client 2''s companies');
select results_eq('select id from public.warehouses', $$ values ('a2000000-0000-0000-0000-000000000001'::uuid) $$,
  'a client sees only warehouses it has a contract with');
select throws_ok($$ insert into public.clients (company_name) values ('Sneaky') $$, '42501', null,
  'a client cannot create clients');
select lives_ok($$ insert into public.company_master (client_id, name) values ('c2000000-0000-0000-0000-000000000001', 'My New Buyer') $$,
  'a client can add its own receiver company');
select throws_ok($$ insert into public.company_master (client_id, name) values ('c2000000-0000-0000-0000-000000000002', 'Not mine') $$,
  '42501', null, 'a client cannot add companies for another client');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.clients where id = 'c2000000-0000-0000-0000-000000000003'), 0,
  'staff do not see clients without a contract in their warehouse');
select throws_ok($$ insert into public.contracts (client_id, warehouse_id, start_date) values
  ('c2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', current_date) $$,
  '42501', null, 'staff cannot create contracts');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.clients where id = 'c2000000-0000-0000-0000-000000000003'), 1,
  'managers see every client so they can onboard them');

-- ---------------------------------------------------------------------
-- C. Space booking
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select lives_ok($$ insert into public.space_bookings (id, client_id, warehouse_id, storage_type, temp_setpoint_c,
                     brigades_requested, from_date, expected_days)
                   values ('f2000000-0000-0000-0000-0000000000b1', 'c2000000-0000-0000-0000-000000000001',
                           'a2000000-0000-0000-0000-000000000001', 'FROZEN', -18, 2, current_date, 30) $$,
  'a client can request space for itself');
select is((select booking_no from public.space_bookings where id = 'f2000000-0000-0000-0000-0000000000b1'),
  'BK/PA/' || (select fy from t_fy) || '/0001', 'bookings get a per-warehouse, per-year number');
select throws_ok($$ insert into public.space_bookings (client_id, warehouse_id, storage_type, temp_setpoint_c,
                     brigades_requested, from_date, expected_days)
                   values ('c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'FROZEN', -18, 1, current_date, 5) $$,
  'WMS14', null, 'a client cannot book a warehouse it has no contract with');
select is((select free_slots from public.check_space_availability('a2000000-0000-0000-0000-000000000001', 'FROZEN', -18)), 6,
  'availability counts free slots in zones whose band holds the set-point');
select is((select count(*)::int from public.check_space_availability('a2000000-0000-0000-0000-000000000001', 'CHILLED', -18)), 0,
  'no zone qualifies when the set-point is outside every band');
select throws_ok($$ select public.approve_booking('f2000000-0000-0000-0000-0000000000b1') $$, '42501', null,
  'a client cannot approve its own booking');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.approve_booking('f2000000-0000-0000-0000-0000000000b1') $$, '42501', null,
  'staff cannot approve bookings');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.approve_booking('f2000000-0000-0000-0000-0000000000b1', 'ok'), 2, 'manager approval reserves 2 slots');
select is((select count(*)::int from public.brigade_slots
           where status = 'RESERVED' and reserved_client_id = 'c2000000-0000-0000-0000-000000000001'), 2,
  'the reserved slots belong to the client');
insert into public.space_bookings (id, client_id, warehouse_id, storage_type, temp_setpoint_c, brigades_requested, from_date, expected_days)
values ('f2000000-0000-0000-0000-0000000000b2', 'c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'FROZEN', -18, 50, current_date, 5);
select throws_ok($$ select public.approve_booking('f2000000-0000-0000-0000-0000000000b2') $$, 'WMS05', null,
  'approval fails when there are not enough matching free slots');
select is((select count(*)::int from public.brigade_slots where status = 'RESERVED'), 2,
  'a failed approval reserves nothing');
select throws_ok($$ update public.brigade_slots set status = 'RESERVED' where id = 'e2000000-0000-0000-0000-000000000026' $$,
  '42501', null, 'slots cannot be reserved by a direct update');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty('select id from public.space_bookings', 'client 2 cannot see client 1''s bookings');

-- ---------------------------------------------------------------------
-- D. Gate entry + inward receipt
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok($$ insert into public.gate_entries (id, warehouse_id, direction, client_id, company_id, lorry_number,
                     driver_name, eway_bill_number, seal_number_arrival, lorry_temp_c)
                   values ('f2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'INWARD',
                           'c2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001',
                           'tn 01 ab-1234', 'Murugan', '1234 5678 9012', 'S-100', -19) $$,
  'staff record an inward lorry');
select is((select gate_pass_no || ' ' || lorry_number || ' ' || eway_bill_number from public.gate_entries
           where id = 'f2000000-0000-0000-0000-000000000001'),
  'GP/PA/' || (select fy from t_fy) || '/0001 TN01AB1234 123456789012', 'gate pass numbered, lorry and e-way bill normalised');
select lives_ok($$ insert into public.gate_entry_lines (id, gate_entry_id, warehouse_id, client_id, line_no, item_name, sku, batch_no,
                     expiry_date, packages, unit, declared_qty, weight_kg, storage_type, required_temp_c) values
  ('f2000000-0000-0000-0000-000000000011', 'f2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 'Frozen peas', 'FRZ-001', 'B-LATE', '2027-06-30', 100, 'BOX', 100, 1200, 'FROZEN', -18),
  ('f2000000-0000-0000-0000-000000000012', 'f2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 'Rice bags', 'DRY-001', 'R-1', null, 50, 'BAG', 50, 400, 'DRY', null),
  ('f2000000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 3, 'Ice cream', 'ICE-001', 'IC-1', '2027-02-28', 20, 'BOX', 20, 200, 'FROZEN', -18) $$,
  'staff add the load lines (frozen, dry, frozen)');
select throws_ok($$ insert into public.gate_entries (warehouse_id, direction, client_id, lorry_number)
                   values ('a2000000-0000-0000-0000-000000000002', 'INWARD', 'c2000000-0000-0000-0000-000000000002', 'TN02CD5678') $$,
  '42501', null, 'staff cannot record lorries at another warehouse');
select throws_ok($$ update public.gate_entries set status = 'RECEIVED' where id = 'f2000000-0000-0000-0000-000000000001' $$,
  'WMS03', null, 'RECEIVED can only be set by confirming a receipt');
select throws_ok($$ update public.gate_entries set status = 'CANCELLED', cancel_reason = 'x' where id = 'f2000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'staff cannot cancel a gate entry');
select lives_ok($$ update public.gate_entries set status = 'UNLOADING' where id = 'f2000000-0000-0000-0000-000000000001' $$,
  'staff start unloading');

select is((select count(*)::int from public.suggest_inward_slots('f2000000-0000-0000-0000-000000000001')
           where gate_entry_line_id = 'f2000000-0000-0000-0000-000000000011' and reserved), 2,
  '1200 kg of frozen goods are suggested into the client''s 2 reserved slots first');
select is((select zone_code from public.suggest_inward_slots('f2000000-0000-0000-0000-000000000001')
           where gate_entry_line_id = 'f2000000-0000-0000-0000-000000000012' limit 1), 'Z1',
  'dry goods are suggested into the dry zone');

-- temperature mismatch: -18 C goods into the 2..8 C chiller
select throws_ok($$ select public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","accepted_qty":100},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","accepted_qty":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","accepted_qty":15,"damaged_qty":5}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000031","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000032","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","slot_id":"e2000000-0000-0000-0000-000000000011","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":15},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":5,"condition":"DAMAGED"}]') $$,
  'WMS01', null, 'a -18 C item cannot go into a 2..8 C zone');
-- over capacity: 1200 kg into one 1000 kg brigade
select throws_ok($$ select public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","accepted_qty":100},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","accepted_qty":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","accepted_qty":20}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000021","quantity":100},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","slot_id":"e2000000-0000-0000-0000-000000000011","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":20}]') $$,
  'WMS02', null, 'a brigade cannot take more than its maximum weight');
-- placed quantities must match the count
select throws_ok($$ select public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","accepted_qty":100},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","accepted_qty":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","accepted_qty":20}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000021","quantity":60},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","slot_id":"e2000000-0000-0000-0000-000000000011","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":20}]') $$,
  'WMS06', null, 'placed quantity must equal the counted quantity');

-- rollback: the failed attempts left nothing behind
select is((select count(*)::int from public.inward_receipts), 0, 'failed confirmations created no receipt');
select is((select count(*)::int from public.stock_items), 0, 'failed confirmations created no stock');
select is((select status::text from public.gate_entries where id = 'f2000000-0000-0000-0000-000000000001'), 'UNLOADING',
  'failed confirmations left the gate entry unloading');
select is((select count(*)::int from public.brigade_slots where status = 'OCCUPIED'), 0,
  'failed confirmations occupied no slot');

-- happy path
insert into t_ids select 'grn1', public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","accepted_qty":100},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","accepted_qty":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","accepted_qty":15,"damaged_qty":5,"remarks":"5 cartons crushed"}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000021","quantity":60},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000011","slot_id":"e2000000-0000-0000-0000-000000000022","quantity":40},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000012","slot_id":"e2000000-0000-0000-0000-000000000011","quantity":50},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":15},
    {"gate_entry_line_id":"f2000000-0000-0000-0000-000000000013","slot_id":"e2000000-0000-0000-0000-000000000023","quantity":5,"condition":"DAMAGED"}]',
  '[{"activity":"UNLOADING","packages":170,"tonnes":1.8,"workers":4,"hours":2},
    {"activity":"STACKING","packages":170,"tonnes":1.8,"workers":2,"hours":1}]',
  'All in order');
select is((select receipt_no from public.inward_receipts where id = (select v from t_ids where k = 'grn1')),
  'GR/PA/' || (select fy from t_fy) || '/0001', 'receipt number GR/<wh>/<fy>/0001, within 16 characters');
select is((select count(*)::int from public.brigade_slots where status = 'OCCUPIED'), 4, 'four slots became OCCUPIED');
select is((select count(*)::int from public.stock_items where inward_receipt_id = (select v from t_ids where k = 'grn1')), 5,
  'one stock row per placement');
select is((select count(*)::int from public.stock_movements where movement_type = 'IN'
           and document_id = (select v from t_ids where k = 'grn1')), 5, 'one IN movement per stock row');
select is((select count(*)::int from public.slot_allocations where end_date is null and client_id = 'c2000000-0000-0000-0000-000000000001'), 4,
  'an open allocation (start date) per occupied slot for Phase 3 billing');
select is((select status::text from public.gate_entries where id = 'f2000000-0000-0000-0000-000000000001'), 'RECEIVED',
  'the gate entry is RECEIVED');
select is((select condition::text || ' ' || damaged_qty || ' ' || short_qty from public.inward_receipt_lines
           where gate_entry_line_id = 'f2000000-0000-0000-0000-000000000013'), 'DAMAGED 5.000 0.000',
  'the damaged line is recorded with its damaged quantity');
select is((select count(*)::int from public.stock_items where condition = 'DAMAGED'), 1, 'damaged goods are held as DAMAGED stock');
select is((select count(*)::int from public.labour_entries where document_id = (select v from t_ids where k = 'grn1')), 2,
  'labour facts are stored with the receipt');
select throws_ok($$ select public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001', '[]', '[]') $$,
  'WMS03', null, 'a gate entry cannot be received twice');

-- second receipt: same SKU, earlier expiry (for FEFO)
insert into public.gate_entries (id, warehouse_id, direction, client_id, lorry_number)
values ('f2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'INWARD', 'c2000000-0000-0000-0000-000000000001', 'TN09XY0001');
insert into public.gate_entry_lines (id, gate_entry_id, warehouse_id, client_id, line_no, item_name, sku, batch_no, expiry_date, packages, unit,
  declared_qty, weight_kg, storage_type, required_temp_c)
values ('f2000000-0000-0000-0000-000000000021', 'f2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000001', 1, 'Frozen peas', 'FRZ-001', 'B-EARLY', '2027-01-31', 30, 'BOX', 30, 360, 'FROZEN', -18);
insert into t_ids select 'grn2', public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000002',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000021","accepted_qty":30}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000021","slot_id":"e2000000-0000-0000-0000-000000000024","quantity":30}]');
select is((select receipt_no from public.inward_receipts where id = (select v from t_ids where k = 'grn2')),
  'GR/PA/' || (select fy from t_fy) || '/0002', 'receipt numbers are sequential');

-- ---------------------------------------------------------------------
-- E. Dispatch request, FEFO picking, scanning, challan
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select lives_ok($$ insert into public.dispatch_requests (id, client_id, warehouse_id, to_company_id, requested_date)
                   values ('f2000000-0000-0000-0000-0000000000d1', 'c2000000-0000-0000-0000-000000000001',
                           'a2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', current_date) $$,
  'a client raises a dispatch request');
select lives_ok($$ insert into public.dispatch_request_lines (request_id, warehouse_id, client_id, line_no, item_name, sku, unit, quantity)
                   values ('f2000000-0000-0000-0000-0000000000d1', 'a2000000-0000-0000-0000-000000000001',
                           'c2000000-0000-0000-0000-000000000001', 1, 'Frozen peas', 'FRZ-001', 'BOX', 40) $$,
  'the client adds a line: 40 boxes of FRZ-001');
select throws_ok($$ insert into public.dispatch_requests (client_id, warehouse_id, to_company_id, requested_date)
                   values ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001',
                           'b2000000-0000-0000-0000-000000000003', current_date) $$,
  '42501', null, 'a client cannot raise a request for another client');
select is((select count(*)::int from public.stock_items), 6, 'client 1 sees its own stock');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty('select id from public.stock_items', 'client 2 cannot read client 1''s stock');
select is_empty('select id from public.inward_receipts', 'client 2 cannot read client 1''s receipts');
select is_empty('select id from public.dispatch_requests', 'client 2 cannot read client 1''s dispatch requests');
select is_empty('select id from public.gate_entries', 'client 2 cannot read client 1''s lorries');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.approve_dispatch_request('f2000000-0000-0000-0000-0000000000d1') $$, '42501', null,
  'staff cannot approve dispatches');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.approve_dispatch_request('f2000000-0000-0000-0000-0000000000d1'), 2, 'approval creates a 2-pick list');
select results_eq($$ select batch_no, quantity from public.dispatch_picks
                     where request_id = 'f2000000-0000-0000-0000-0000000000d1' order by pick_seq $$,
  $$ values ('B-EARLY'::text, 30.000::numeric), ('B-LATE'::text, 10.000::numeric) $$,
  'FEFO: the earliest expiry batch is picked first');
insert into public.dispatch_requests (id, client_id, warehouse_id, to_company_id, requested_date)
values ('f2000000-0000-0000-0000-0000000000d2', 'c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
        'b2000000-0000-0000-0000-000000000002', current_date);
insert into public.dispatch_request_lines (request_id, warehouse_id, client_id, line_no, item_name, sku, unit, quantity)
values ('f2000000-0000-0000-0000-0000000000d2', 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 'Frozen peas', 'FRZ-001', 'BOX', 1000);
select throws_ok($$ select public.approve_dispatch_request('f2000000-0000-0000-0000-0000000000d2') $$, 'WMS04', null,
  'approval fails on insufficient stock');
select is((select count(*)::int from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d2'), 0,
  'a failed approval leaves no picks');
-- FIFO client setting: the earliest *received* batch goes first
update public.clients set pick_rule = 'FIFO' where id = 'c2000000-0000-0000-0000-000000000001';
insert into public.dispatch_requests (id, client_id, warehouse_id, to_company_id, requested_date)
values ('f2000000-0000-0000-0000-0000000000d3', 'c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
        'b2000000-0000-0000-0000-000000000002', current_date);
insert into public.dispatch_request_lines (request_id, warehouse_id, client_id, line_no, item_name, sku, unit, quantity)
values ('f2000000-0000-0000-0000-0000000000d3', 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 'Frozen peas', 'FRZ-001', 'BOX', 5);
select public.approve_dispatch_request('f2000000-0000-0000-0000-0000000000d3');
select is((select batch_no from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d3' order by pick_seq limit 1),
  'B-LATE', 'FIFO: the first received batch is picked first');
select public.cancel_dispatch_request('f2000000-0000-0000-0000-0000000000d3', 'test only');
update public.clients set pick_rule = 'FEFO' where id = 'c2000000-0000-0000-0000-000000000001';

-- picking by scan (staff)
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into public.gate_entries (id, warehouse_id, direction, client_id, company_id, lorry_number, driver_name)
values ('f2000000-0000-0000-0000-0000000000e1', 'a2000000-0000-0000-0000-000000000001', 'OUTWARD',
        'c2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'TN10ZZ9999', 'Kannan');
select throws_ok($$ select public.confirm_delivery_challan('f2000000-0000-0000-0000-0000000000d1', 'f2000000-0000-0000-0000-0000000000e1') $$,
  'WMS13', null, 'a challan cannot be confirmed before every pick is scanned');
select throws_ok(format($$ select public.record_pick_scan(%L, %L) $$,
    (select id from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d1' and pick_seq = 1),
    'WMS:STOCK:' || (select id from public.stock_items where batch_no = 'B-LATE' order by id limit 1)),
  'WMS11', null, 'scanning the wrong batch is blocked');
select lives_ok(format($$ select public.record_pick_scan(%L, %L) $$,
    (select id from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d1' and pick_seq = 1),
    'WMS:STOCK:' || (select stock_item_id from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d1' and pick_seq = 1)),
  'scanning the right batch label marks the pick');
select lives_ok(format($$ select public.record_pick_scan(%L, 'b-late') $$,
    (select id from public.dispatch_picks where request_id = 'f2000000-0000-0000-0000-0000000000d1' and pick_seq = 2)),
  'scanning the batch number itself is accepted');
select is((select status::text from public.dispatch_requests where id = 'f2000000-0000-0000-0000-0000000000d1'), 'PICKING',
  'the request moves to PICKING');

-- rollback: second pick's stock is short at confirm time -> nothing is written
reset role;
insert into t_ids select 'pick2_item', stock_item_id from public.dispatch_picks
  where request_id = 'f2000000-0000-0000-0000-0000000000d1' and pick_seq = 2;
create temp table t_qty as select quantity from public.stock_items where id = (select v from t_ids where k = 'pick2_item');
update public.stock_items set quantity = 5 where id = (select v from t_ids where k = 'pick2_item');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.confirm_delivery_challan('f2000000-0000-0000-0000-0000000000d1', 'f2000000-0000-0000-0000-0000000000e1', -19, 'SEAL-9') $$,
  'WMS04', null, 'confirming fails when stock is short');
select is((select quantity from public.stock_items where batch_no = 'B-EARLY'), 30.000::numeric,
  'the first pick was not deducted (whole challan rolled back)');
select is((select count(*)::int from public.stock_movements where movement_type = 'OUT'), 0, 'no OUT movement was written');
reset role;
update public.stock_items set quantity = (select quantity from t_qty) where id = (select v from t_ids where k = 'pick2_item');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

insert into t_ids select 'dc1', public.confirm_delivery_challan('f2000000-0000-0000-0000-0000000000d1', 'f2000000-0000-0000-0000-0000000000e1',
  -19, 'SEAL-9', 'Ravi', 'a2000000-0000-0000-0000-000000000001/d1/sig.png',
  '[{"activity":"LOADING","packages":40,"tonnes":0.48,"workers":3,"hours":1.5}]');
select is((select challan_no from public.delivery_challans where id = (select v from t_ids where k = 'dc1')),
  'DC/PA/' || (select fy from t_fy) || '/0001', 'challan numbered DC/<wh>/<fy>/0001');
select is((select quantity from public.stock_items where batch_no = 'B-EARLY'), 0.000::numeric, 'the FEFO batch was fully dispatched');
select is((select status::text from public.brigade_slots where id = 'e2000000-0000-0000-0000-000000000024'), 'FREE',
  'its emptied slot is FREE again');
select isnt((select end_date from public.slot_allocations where slot_id = 'e2000000-0000-0000-0000-000000000024' order by created_at limit 1), null,
  'the allocation of the emptied slot got an end date');
select is((select count(*)::int from public.stock_movements where movement_type = 'OUT'
           and document_id = (select v from t_ids where k = 'dc1')), 2, 'one OUT movement per pick');
select is((select status::text || ' ' || seal_number_departure from public.gate_entries where id = 'f2000000-0000-0000-0000-0000000000e1'),
  'DISPATCHED SEAL-9', 'the outward lorry is DISPATCHED with its seal');
select is((select status::text from public.dispatch_requests where id = 'f2000000-0000-0000-0000-0000000000d1'), 'DISPATCHED',
  'the request is DISPATCHED');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*)::int from public.delivery_challans), 1, 'client 1 sees its challan');
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty('select id from public.delivery_challans', 'client 2 cannot read client 1''s challans');

-- ---------------------------------------------------------------------
-- F. Cancellation (manager + reason, reversed by new movements)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_delivery_challan((select v from t_ids where k = 'dc1'), 'wrong lorry') $$,
  '42501', null, 'staff cannot cancel a challan');
select throws_ok($$ select public.cancel_inward_receipt((select v from t_ids where k = 'grn1'), 'wrong client') $$,
  '42501', null, 'staff cannot cancel a receipt');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_delivery_challan((select v from t_ids where k = 'dc1'), '  ') $$,
  'WMS08', null, 'cancelling needs a reason');
select lives_ok($$ select public.cancel_delivery_challan((select v from t_ids where k = 'dc1'), 'Lorry broke down') $$,
  'a manager cancels the challan with a reason');
select is((select quantity from public.stock_items where batch_no = 'B-EARLY'), 30.000::numeric, 'cancelled challan puts the stock back');
select is((select status::text from public.brigade_slots where id = 'e2000000-0000-0000-0000-000000000024'), 'OCCUPIED',
  'the slot is occupied again');
select is((select count(*)::int from public.slot_allocations
           where slot_id = 'e2000000-0000-0000-0000-000000000024' and end_date is null and not cancelled
             and start_document_type = 'INWARD_RECEIPT'), 1,
  'the original allocation is re-opened (no billing gap)');
select is((select count(*)::int from public.stock_movements where movement_type = 'ADJUSTMENT'
           and document_type = 'DELIVERY_CHALLAN_CANCEL'), 2, 'the reversal is written as new movements');
select throws_ok($$ select public.cancel_inward_receipt((select v from t_ids where k = 'grn2'), 'test') $$,
  'WMS09', null, 'a receipt whose goods already moved cannot be cancelled');

-- a fresh receipt can be cancelled cleanly
insert into public.gate_entries (id, warehouse_id, direction, client_id, lorry_number)
values ('f2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'INWARD', 'c2000000-0000-0000-0000-000000000001', 'TN01QQ0003');
insert into public.gate_entry_lines (id, gate_entry_id, warehouse_id, client_id, line_no, item_name, sku, unit, declared_qty, weight_kg, storage_type)
values ('f2000000-0000-0000-0000-000000000031', 'f2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000001', 1, 'Sugar', 'DRY-002', 'BAG', 10, 500, 'DRY');
insert into t_ids select 'grn3', public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000003',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000031","accepted_qty":10}]',
  '[{"gate_entry_line_id":"f2000000-0000-0000-0000-000000000031","slot_id":"e2000000-0000-0000-0000-000000000012","quantity":10}]');
select lives_ok($$ select public.cancel_inward_receipt((select v from t_ids where k = 'grn3'), 'Duplicate entry') $$,
  'a manager cancels an untouched receipt');
select is((select status::text || ' ' || (select status::text from public.brigade_slots where id = 'e2000000-0000-0000-0000-000000000012')
           from public.inward_receipts where id = (select v from t_ids where k = 'grn3')), 'CANCELLED FREE',
  'the receipt is CANCELLED and its slot is FREE again');

-- ---------------------------------------------------------------------
-- G. Stock operations and ledger protection
-- ---------------------------------------------------------------------
select throws_ok($$ insert into public.stock_items (client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, unit, quantity)
                   values ('c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
                           'd2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000013', 'x', 'x', 'BOX', 1) $$,
  '42501', null, 'stock cannot be inserted directly, even by a manager');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into t_ids select 'late40', id from public.stock_items where batch_no = 'B-LATE' and slot_id = 'e2000000-0000-0000-0000-000000000022';
select throws_ok($$ select public.transfer_stock((select v from t_ids where k = 'late40'), 'e2000000-0000-0000-0000-000000000013', 10) $$,
  'WMS01', null, 'frozen stock cannot be transferred into the dry zone');
select lives_ok($$ select public.transfer_stock((select v from t_ids where k = 'late40'), 'e2000000-0000-0000-0000-000000000025', 10, 'consolidate') $$,
  'staff transfer 10 boxes to another frozen slot');
select is((select count(*)::int from public.stock_movements where movement_type = 'TRANSFER'), 2,
  'a transfer writes a pair of TRANSFER movements');
select throws_ok($$ select public.adjust_stock((select v from t_ids where k = 'late40'), 25, 'count') $$,
  '42501', null, 'staff cannot adjust stock');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.adjust_stock((select v from t_ids where k = 'late40'), 25, '') $$,
  'WMS08', null, 'an adjustment needs a reason');
select lives_ok($$ select public.adjust_stock((select v from t_ids where k = 'late40'), 25, 'Cycle count found 5 missing') $$,
  'a manager adjusts stock with a reason');
select is((select qty_delta from public.stock_movements where movement_type = 'ADJUSTMENT' and document_type = 'ADJUSTMENT'), -5.000::numeric,
  'the adjustment is in the ledger');

-- audit: status changes are logged with the user
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok(exists (select 1 from public.audit_logs where table_name = 'gate_entries'
                  and old_data ->> 'status' = 'UNLOADING' and new_data ->> 'status' = 'RECEIVED'
                  and changed_by = '12000000-0000-0000-0000-000000000003'),
  'the gate entry status change is in the audit log with the staff member');

reset role;
select throws_ok($$ update public.stock_movements set qty_delta = 0 $$, '42501', null,
  'the stock ledger is append-only even for the database owner');

-- ---------------------------------------------------------------------
-- H. Anonymous users
-- ---------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select id from public.stock_items', '42501', null, 'anon cannot read stock');
select throws_ok('select id from public.clients', '42501', null, 'anon cannot read clients');
select throws_ok('select id from public.delivery_challans', '42501', null, 'anon cannot read challans');
select throws_ok($$ select public.confirm_inward_receipt('f2000000-0000-0000-0000-000000000001', '[]', '[]') $$,
  '42501', null, 'anon cannot call the confirm functions');

reset role;
select * from finish();
rollback;
