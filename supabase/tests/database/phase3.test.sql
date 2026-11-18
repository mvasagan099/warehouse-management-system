-- =====================================================================
-- Phase 3 database tests: rate resolution, occupancy, rent + labour totals (hand calculated), GST, issue and
-- immutability, notes, payments, ledger, overdue, credit block, reports and RLS per role. Rolled back at the end.
-- Timeline (T = today in India):  allocations start at T-10; invoices bill T-10 .. T-1.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(125);

-- ---------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------
insert into public.warehouses (id, code, name) values
  ('a3000000-0000-0000-0000-000000000001', 'P3', 'Phase3 A'), ('a3000000-0000-0000-0000-000000000002', 'P4', 'Phase3 B');
insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values
  ('d3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Z1', 'Dry',    'DRY',    null, null),
  ('d3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'Z2', 'Frozen', 'FROZEN', -25, -15);
insert into public.brigade_slots (id, warehouse_id, zone_id, brigade_type_id, aisle, rack, level, position, code)
select ('b3000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'a3000000-0000-0000-0000-000000000001', z, (select id from public.brigade_types where is_default), 1, 1, 1, n, c
from (values (1, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F1'), (2, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F2'), (3, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F3'),
             (4, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F4'), (5, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F5'), (6, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F6'),
             (7, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F7'), (8, 'd3000000-0000-0000-0000-000000000002'::uuid, 'P3-F8'),
             (9, 'd3000000-0000-0000-0000-000000000001'::uuid, 'P3-D1'), (10, 'd3000000-0000-0000-0000-000000000001'::uuid, 'P3-D2')) v(n, z, c);

insert into public.client_groups (id, name) values ('91000000-0000-0000-0000-000000000001', 'Group One');
insert into public.clients (id, company_name, gstin, group_id, credit_limit_paise, gst_exempt, gst_exempt_reason) values
  ('c3000000-0000-0000-0000-00000000000a', 'Client A (TN, GSTIN)',  '33AABCT1332L1ZL', '91000000-0000-0000-0000-000000000001', 100000, false, null),
  ('c3000000-0000-0000-0000-00000000000b', 'Client B (MH, GSTIN)',  '27AAPFU0939F1ZV', null, 0, false, null),
  ('c3000000-0000-0000-0000-00000000000c', 'Client C (no GSTIN)',   null,              '91000000-0000-0000-0000-000000000001', 0, false, null),
  ('c3000000-0000-0000-0000-00000000000d', 'Client D (exempt)',     '33AAACR5055K1ZE', null, 0, true, 'Exempt agricultural produce'),
  ('c3000000-0000-0000-0000-00000000000e', 'Client E (free+min)',   null,              null, 0, false, null);
insert into public.contracts (client_id, warehouse_id, start_date, status, security_deposit_paise)
select id, 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 60, 'ACTIVE', case when id = 'c3000000-0000-0000-0000-00000000000a' then 50000 else 0 end from public.clients where id::text like 'c3000000%';

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('d3000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-admin@test.local', '{"role":"SUPER_ADMIN"}'),
  ('d3000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-acct@test.local',  '{"role":"ACCOUNTANT"}'),
  ('d3000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-mgr@test.local',   '{"role":"WAREHOUSE_MANAGER"}'),
  ('d3000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-staff@test.local', '{"role":"STAFF","warehouse_id":"a3000000-0000-0000-0000-000000000001"}'),
  ('d3000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-ca@test.local',    '{"role":"CLIENT","client_id":"c3000000-0000-0000-0000-00000000000a"}'),
  ('d3000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-cb@test.local',    '{"role":"CLIENT","client_id":"c3000000-0000-0000-0000-00000000000b"}');
insert into public.warehouse_managers (warehouse_id, user_id) values ('a3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-0000000000f3');

-- rate cards: GLOBAL, WAREHOUSE P3, GROUP, CLIENT A (tiers, discounts), CLIENT E (free + minimum days), CLIENT C (expired)
insert into public.rate_cards (id, name, scope, client_id, group_id, warehouse_id, valid_from, valid_to, rent_discount_bp, labour_discount_bp, free_days, min_billing_days) values
  ('e3000000-0000-0000-0000-000000000001', 'Global',    'GLOBAL',    null, null, null, public.today_ist() - 100, null, 0, 0, 0, 0),
  ('e3000000-0000-0000-0000-000000000002', 'Warehouse', 'WAREHOUSE', null, null, 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 100, null, 0, 0, 0, 0),
  ('e3000000-0000-0000-0000-000000000003', 'Group',     'GROUP',     null, '91000000-0000-0000-0000-000000000001', null, public.today_ist() - 100, null, 0, 0, 0, 0),
  ('e3000000-0000-0000-0000-000000000004', 'Client A',  'CLIENT',    'c3000000-0000-0000-0000-00000000000a', null, null, public.today_ist() - 100, null, 1000, 500, 0, 0),
  ('e3000000-0000-0000-0000-000000000005', 'Client E',  'CLIENT',    'c3000000-0000-0000-0000-00000000000e', null, null, public.today_ist() - 100, null, 0, 0, 2, 5),
  ('e3000000-0000-0000-0000-000000000006', 'Client C old', 'CLIENT', 'c3000000-0000-0000-0000-00000000000c', null, null, public.today_ist() - 30, public.today_ist() - 20, 0, 0, 0, 0);
insert into public.rent_rates (rate_card_id, storage_type, temp_min, temp_max, basis, rate_paise, tier_from, tier_to, valid_from) values
  ('e3000000-0000-0000-0000-000000000001', 'FROZEN', null, null, 'PER_BRIGADE', 10000, null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000001', 'DRY',    null, null, 'PER_BRIGADE', 5000,  null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000001', 'HAZMAT', null, null, 'PER_BRIGADE', 20000, null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000001', 'HAZMAT', 0, 4,       'PER_BRIGADE', 22000, null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000002', 'FROZEN', null, null, 'PER_BRIGADE', 9000,  null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000003', 'FROZEN', null, null, 'PER_BRIGADE', 8000,  null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000004', 'FROZEN', null, null, 'PER_BRIGADE', 7500,  1, 2,       public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000004', 'FROZEN', null, null, 'PER_BRIGADE', 7000,  3, null,    public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000004', 'DRY',    null, null, 'PER_BRIGADE', 4000,  null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000005', 'FROZEN', null, null, 'PER_BRIGADE', 10000, null, null, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000006', 'FROZEN', null, null, 'PER_BRIGADE', 6000,  null, null, public.today_ist() - 30);
insert into public.labour_rates (rate_card_id, activity, basis, rate_paise, cold_premium_type, cold_premium_value, night_multiplier_bp, overtime_multiplier_bp, valid_from) values
  ('e3000000-0000-0000-0000-000000000001', 'LOADING',   'PER_TONNE',   8000, 'AMOUNT', 50, 10000, 12000, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000001', 'UNLOADING', 'PER_PACKAGE', 400,  'NONE',   0,  10000, 10000, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000004', 'UNLOADING', 'PER_PACKAGE', 500,  'PERCENT', 2000, 15000, 10000, public.today_ist() - 100),
  ('e3000000-0000-0000-0000-000000000004', 'STACKING',  'PER_PACKAGE', 300,  'NONE',   0,  10000, 10000, public.today_ist() - 100);

-- allocations (client, slot, start, end)
insert into public.slot_allocations (client_id, warehouse_id, zone_id, slot_id, brigade_type_id, start_date, end_date)
select c, 'a3000000-0000-0000-0000-000000000001', z, ('b3000000-0000-0000-0000-0000000000' || lpad(s::text, 2, '0'))::uuid, (select id from public.brigade_types where is_default), st, en
from (values
  ('c3000000-0000-0000-0000-00000000000a'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 1,  public.today_ist() - 10, null::date),
  ('c3000000-0000-0000-0000-00000000000a'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 2,  public.today_ist() - 10, null),
  ('c3000000-0000-0000-0000-00000000000a'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 3,  public.today_ist() - 10, public.today_ist() - 6),   -- moved on T-6
  ('c3000000-0000-0000-0000-00000000000a'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 5,  public.today_ist() - 6,  null),                      -- ...to this slot
  ('c3000000-0000-0000-0000-00000000000a'::uuid, 'd3000000-0000-0000-0000-000000000001'::uuid, 9,  public.today_ist() - 10, public.today_ist() - 5),   -- dry, released T-5
  ('c3000000-0000-0000-0000-00000000000b'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 6,  public.today_ist() - 4,  public.today_ist() - 4),   -- in and out the same day
  ('c3000000-0000-0000-0000-00000000000c'::uuid, 'd3000000-0000-0000-0000-000000000001'::uuid, 10, public.today_ist() - 8,  null),
  ('c3000000-0000-0000-0000-00000000000d'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 8,  public.today_ist() - 3,  null),
  ('c3000000-0000-0000-0000-00000000000e'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 4,  public.today_ist() - 10, null),
  ('c3000000-0000-0000-0000-00000000000e'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 7,  public.today_ist() - 6,  public.today_ist() - 4)) v(c, z, s, st, en);
insert into public.slot_allocations (client_id, warehouse_id, zone_id, slot_id, brigade_type_id, start_date, end_date, cancelled)
values ('c3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000007',
        (select id from public.brigade_types where is_default), public.today_ist() - 10, null, true);   -- cancelled: never counted

-- labour documents of client A: receipt on T-3 (night unloading), challan on T-2 (overtime loading, frozen slot)
insert into public.gate_entries (id, warehouse_id, direction, status, client_id, lorry_number) values
  ('f3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'INWARD',  'RECEIVED',   'c3000000-0000-0000-0000-00000000000a', 'TN01AB1234'),
  ('f3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'OUTWARD', 'DISPATCHED', 'c3000000-0000-0000-0000-00000000000a', 'TN09CD5678');
insert into public.gate_entry_lines (id, gate_entry_id, warehouse_id, client_id, line_no, item_name, declared_qty, storage_type) values
  ('f3100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 1, 'Peas', 100, 'FROZEN'),
  ('f3100000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 2, 'Rice', 50, 'DRY');
insert into public.inward_receipts (id, receipt_no, warehouse_id, client_id, gate_entry_id, received_at) values
  ('f3200000-0000-0000-0000-000000000001', 'GR/P3/TEST/0001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-000000000001',
   ((public.today_ist() - 3)::timestamp + interval '10 hours') at time zone 'Asia/Kolkata');
insert into public.inward_receipt_lines (receipt_id, warehouse_id, client_id, gate_entry_line_id, line_no, item_name, unit, packages, declared_qty, condition, storage_type) values
  ('f3200000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'f3100000-0000-0000-0000-000000000001', 1, 'Peas', 'BOX', 100, 100, 'GOOD', 'FROZEN'),
  ('f3200000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'f3100000-0000-0000-0000-000000000002', 2, 'Rice', 'BAG', 50, 50, 'GOOD', 'DRY');
insert into public.labour_entries (warehouse_id, client_id, document_type, document_id, activity, packages, tonnes, workers, hours, is_night) values
  ('a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'INWARD_RECEIPT', 'f3200000-0000-0000-0000-000000000001', 'UNLOADING', 150, 1.8, 4, 2, true),
  ('a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'INWARD_RECEIPT', 'f3200000-0000-0000-0000-000000000001', 'STACKING',  150, 1.8, 2, 1, false);
insert into public.company_master (id, client_id, kind, name) values ('f3300000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'RECEIVER', 'Receiver Mart');
insert into public.dispatch_requests (id, client_id, warehouse_id, to_company_id, requested_date, status) values
  ('f3400000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'f3300000-0000-0000-0000-000000000001', public.today_ist() - 2, 'DISPATCHED');
insert into public.stock_items (id, client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, unit, quantity) values
  ('f3500000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001', 'P3-F1', 'Peas', 'BOX', 0);
insert into public.delivery_challans (id, challan_no, warehouse_id, client_id, dispatch_request_id, gate_entry_id, to_company_id, dispatched_at) values
  ('f3600000-0000-0000-0000-000000000001', 'DC/P3/TEST/0001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'f3400000-0000-0000-0000-000000000001',
   'f3000000-0000-0000-0000-000000000002', 'f3300000-0000-0000-0000-000000000001', ((public.today_ist() - 2)::timestamp + interval '15 hours') at time zone 'Asia/Kolkata');
insert into public.delivery_challan_lines (challan_id, warehouse_id, client_id, stock_item_id, slot_id, slot_code, line_no, item_name, unit, quantity, packages) values
  ('f3600000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'f3500000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'P3-F1', 1, 'Peas', 'BOX', 40, 40);
insert into public.labour_entries (warehouse_id, client_id, document_type, document_id, activity, packages, tonnes, workers, hours, is_overtime) values
  ('a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'DELIVERY_CHALLAN', 'f3600000-0000-0000-0000-000000000001', 'LOADING', 40, 2.0, 3, 2, true);

select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
create temp table t3 (k text primary key, v uuid);
grant all on t3 to authenticated;

-- ---------------------------------------------------------------------
-- A. Rate resolution
-- ---------------------------------------------------------------------
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 5, 5)), 7000::bigint,
  'client rate card beats group, warehouse and global (5 brigades: tier 3+)');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 5, 2)), 7500::bigint,
  'volume tier: 1 to 2 brigades uses its own rate');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'DRY', null, null, null, public.today_ist() - 5, 1)), 4000::bigint,
  'client dry rate');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 5, 1)), 9000::bigint,
  'no client or group card: the warehouse default applies');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 5, 1)), 8000::bigint,
  'client group card beats the warehouse default');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', 'DRY', null, null, null, public.today_ist() - 5, 1)), 5000::bigint,
  'nothing more specific for dry: the global default applies');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000002', 'FROZEN', -20, -18, null, public.today_ist() - 5, 1)), 10000::bigint,
  'another warehouse without its own card gets the global default');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 25, 1)), 6000::bigint,
  'a client rate valid on that date wins');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 10, 1)), 8000::bigint,
  'after the client rate expired the group rate applies');
select is_empty($$ select * from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, current_date - 200, 5) $$,
  'no rate is valid before every rate card starts');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'HAZMAT', 1, 3, null, public.today_ist() - 5, 1)), 22000::bigint,
  'a temperature-band rate is more specific than the generic one');
select is((select rate_paise from public.resolve_rent_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'HAZMAT', null, null, null, public.today_ist() - 5, 1)), 20000::bigint,
  'without a temperature the generic hazmat rate applies');
select is((select rate_paise from public.resolve_labour_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'UNLOADING', public.today_ist())), 500::bigint,
  'labour: client rate beats global');
select is((select rate_paise from public.resolve_labour_rate('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'LOADING', public.today_ist())), 8000::bigint,
  'labour: global rate when the client has none');
select is((select count(*)::int from public.rent_rate_candidates('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'FROZEN', -20, -18, null, public.today_ist() - 5, 5)), 4,
  'the rate tester lists every candidate in precedence order');

-- ---------------------------------------------------------------------
-- B. Daily occupancy
-- ---------------------------------------------------------------------
select throws_ok($$ select public.snapshot_occupancy(public.today_ist() + 1) $$, 'WMS22', null, 'a future day cannot be snapshotted (today can: it is provisional)');
select is(public.snapshot_occupancy_backfill(), 10, 'backfill creates every missing finished day (T-10 .. T-1)');
select is((select sum(brigades)::int from public.daily_occupancy where occ_date = public.today_ist() - 8 and client_id = 'c3000000-0000-0000-0000-00000000000a' and storage_type = 'FROZEN'), 3,
  'client A holds 3 frozen brigades on T-8');
select is((select sum(brigades)::int from public.daily_occupancy where occ_date = public.today_ist() - 6 and client_id = 'c3000000-0000-0000-0000-00000000000a' and storage_type = 'FROZEN'), 3,
  'moving stock between slots mid-period is not double counted (T-6: old slot ended, new one started)');
select is((select sum(brigades)::int from public.daily_occupancy where occ_date = public.today_ist() - 5 and client_id = 'c3000000-0000-0000-0000-00000000000a' and storage_type = 'DRY'), null,
  'the end day is excluded: the dry brigade released on T-5 is not counted that day');
select is((select sum(brigades)::int from public.daily_occupancy where occ_date = public.today_ist() - 6 and client_id = 'c3000000-0000-0000-0000-00000000000a' and storage_type = 'DRY'), 1,
  'and it is counted the day before');
select is((select sum(brigades)::int from public.daily_occupancy where occ_date = public.today_ist() - 4 and client_id = 'c3000000-0000-0000-0000-00000000000b'), 1,
  'a brigade held part of a day (in and out the same day) counts that day');
select is((select count(*)::int from public.daily_occupancy where client_id = 'c3000000-0000-0000-0000-00000000000b' and occ_date = public.today_ist() - 10), 0,
  'a cancelled allocation is never counted');
create temp table t3_snap as select md5(string_agg(format('%s|%s|%s|%s|%s|%s|%s', occ_date, client_id, storage_type, brigade_type_id, brigades, free_brigades, volume_m3), ',' order by occ_date, client_id, storage_type, brigade_type_id)) h,
  count(*) n from public.daily_occupancy;
select public.snapshot_occupancy(public.today_ist() - 8);
select public.snapshot_occupancy(public.today_ist() - 8);
select is((select md5(string_agg(format('%s|%s|%s|%s|%s|%s|%s', occ_date, client_id, storage_type, brigade_type_id, brigades, free_brigades, volume_m3), ',' order by occ_date, client_id, storage_type, brigade_type_id)) from public.daily_occupancy),
  (select h from t3_snap), 'running the snapshot twice for a date changes nothing');
select is(public.snapshot_occupancy_backfill(), 0, 'a second backfill finds nothing missing');
delete from public.occupancy_runs where occ_date = public.today_ist() - 7;
delete from public.daily_occupancy where occ_date = public.today_ist() - 7;
select is(public.snapshot_occupancy_backfill(), 1, 'a missed day is filled by the next backfill');
select is((select count(*)::int from cron.job where jobname = 'wms-occupancy-snapshot' and schedule = '35 18 * * *'), 1, 'the snapshot cron runs at 00:05 India time, stored in UTC (18:35)');
select is((select count(*)::int from cron.job where jobname in ('wms-generate-invoices', 'wms-mark-overdue')), 2, 'invoice generation and overdue marking are scheduled');

-- ---------------------------------------------------------------------
-- C. Rent: client A (tiered 7000, dry 4000, 10 % discount); hand calculated
--    frozen 3 brigades x 10 days x 7000 = 210000; dry 1 x 5 days x 4000 = 20000; discount 21000 + 2000
--    taxable 189000 (996721) + 18000 (996729); CGST = SGST = 17010 + 1620
-- ---------------------------------------------------------------------
insert into t3 select 'invA_rent', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 10, public.today_ist() - 1, 'RENT_ONLY');
select is((select count(*)::int from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA_rent') and section = 'RENT'), 2, 'consecutive days with the same rate are grouped: one frozen line and one dry line');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA_rent') and storage_type = 'FROZEN'), 210000::bigint, 'frozen: 3 brigades x 10 days x 7000');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA_rent') and storage_type = 'DRY'), 20000::bigint, 'dry: 1 brigade x 5 days x 4000');
select ok((select rate_source like 'Client rate card "Client A"%tier 3-up%' from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA_rent') and storage_type = 'FROZEN'), 'every line records its rate source (card and tier)');
select is((select rent_taxable_paise from public.invoices where id = (select v from t3 where k = 'invA_rent')), 207000::bigint, 'rent taxable after the 10 % discount');
select is((select cgst_paise || '/' || sgst_paise || '/' || igst_paise from public.invoices where id = (select v from t3 where k = 'invA_rent')), '18630/18630/0', 'intra-state: CGST and SGST in equal halves');
select is((select grand_total_paise || ' ' || round_off_paise from public.invoices where id = (select v from t3 where k = 'invA_rent')), '244300 40', 'grand total rounds to a whole rupee with a visible round-off');
select is((select string_agg(sac_code || ':' || gst_rate_bp, ',' order by sac_code) from public.invoice_tax_lines where invoice_id = (select v from t3 where k = 'invA_rent')), '996721:1800,996729:1800', 'SAC code and GST rate per storage type come from the tax rules table');
select throws_ok($$ select public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist() - 2, 'RENT_ONLY') $$,
  'WMS26', null, 'rent days already on an invoice cannot be billed again');
select throws_ok($$ select public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist() + 1, 'RENT_ONLY') $$,
  'WMS22', null, 'a period ending in the future cannot be billed (today can)');
select public.discard_draft_invoice((select v from t3 where k = 'invA_rent'), 'rebuild with labour');

-- ---------------------------------------------------------------------
-- D. Both sections for client A; labour hand calculated
--    receipt: UNLOADING 150 x 500 = 75000, night x1.5 = 112500, cold premium 20 % on 100/150 of it = +15000 -> 127500; STACKING 150 x 300 = 45000 -> 172500; 5 % off 8625
--    challan: LOADING 2 t x 8000 = 16000, overtime x1.2 = 19200, cold premium 2 x 50 = +100 -> 19300; 5 % off 965
--    labour taxable 163875 + 18335 = 182210; CGST = SGST = 16399 (16398.9)
--    all: taxable 389210, tax 70058, total 459268 -> grand 459300 (round-off 32)
-- ---------------------------------------------------------------------
insert into t3 select 'invA', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 10, public.today_ist() - 1);
select is((select count(*)::int from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and section = 'LABOUR'), 2, 'one labour line per confirmed receipt or challan');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and doc_no = 'GR/P3/TEST/0001'), 172500::bigint, 'receipt labour: night multiplier and cold premium');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and doc_no = 'DC/P3/TEST/0001'), 19300::bigint, 'challan labour: overtime multiplier and cold amount premium (global rate)');
select is((select lorry_number from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and doc_no = 'GR/P3/TEST/0001'), 'TN01AB1234', 'each labour line shows the lorry number and the document number');
select is((select labour_taxable_paise from public.invoices where id = (select v from t3 where k = 'invA')), 182210::bigint, 'labour taxable after the 5 % discount');
select is((select grand_total_paise || ' ' || round_off_paise || ' ' || cgst_paise from public.invoices where id = (select v from t3 where k = 'invA')), '459300 32 35029', 'combined invoice totals match the hand calculation');
select ok((select billed_invoice_id is not null from public.inward_receipts where id = 'f3200000-0000-0000-0000-000000000001'), 'the receipt is marked as billed');
select throws_ok($$ select public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 10, public.today_ist() - 1, 'LABOUR_ONLY') $$,
  'WMS20', null, 'a receipt or challan already on an invoice cannot be billed twice');
select throws_ok($$ update public.inward_receipts set status = 'CANCELLED' where id = 'f3200000-0000-0000-0000-000000000001' $$, 'WMS29', null, 'a billed receipt cannot be cancelled');

-- ---------------------------------------------------------------------
-- E. Free days and minimum billing days (client E: 2 free days, minimum 5 days, flat 10000)
--    E1 open from T-10: first 2 days free -> 8 days x 10000 = 80000; E2 held T-6..T-5 (2 days, minimum 5): top-up 3 x 10000 = 30000
-- ---------------------------------------------------------------------
insert into t3 select 'invE', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000e', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 10, public.today_ist() - 1);
select is((select sum(amount_paise)::bigint from public.invoice_lines where invoice_id = (select v from t3 where k = 'invE') and description not like 'Minimum%'), 80000::bigint, 'free days: the first 2 days of each brigade are not charged');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invE') and description like 'Minimum billing top-up%'), 30000::bigint, 'minimum billing days: a 2-day stay is topped up to 5 days');
select ok((select min_days_invoice_id is not null from public.slot_allocations where slot_id = 'b3000000-0000-0000-0000-000000000007' and not cancelled), 'the top-up is billed once (allocation marked)');
select is((select grand_total_paise from public.invoices where id = (select v from t3 where k = 'invE')), 129800::bigint, 'consumer client E: 110000 + 18 % tax = 129800 (already a whole rupee)');
select is((select supply_kind || ' ' || place_of_supply from public.invoices where id = (select v from t3 where k = 'invE')), 'CONSUMER 33', 'no GSTIN: billed as a consumer with the supplier-state rule');
select is((select cgst_paise from public.invoices where id = (select v from t3 where k = 'invE')), 9900::bigint, 'consumer: CGST and SGST');

-- ---------------------------------------------------------------------
-- F. GST cases: inter-state IGST, exempt, rounding, tax rules are data
-- ---------------------------------------------------------------------
insert into t3 select 'invB', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist() - 3, 'RENT_ONLY');
select is((select supply_kind || ' ' || cgst_paise || ' ' || sgst_paise || ' ' || igst_paise || ' ' || grand_total_paise || ' ' || round_off_paise from public.invoices where id = (select v from t3 where k = 'invB')), 'INTER 0 0 1620 10600 -20',
  'inter-state: IGST only (9000 x 18 % = 1620), total 10620 rounds down to 10600');
insert into t3 select 'invD', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000d', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 3, public.today_ist() - 1, 'RENT_ONLY');
select is((select tax_paise || ' ' || grand_total_paise from public.invoices where id = (select v from t3 where k = 'invD')), '0 27000', 'exempt client: tax is 0 (3 days x 9000)');
select is((select exempt_reason from public.invoice_tax_lines where invoice_id = (select v from t3 where k = 'invD') limit 1), 'Exempt agricultural produce', 'the exemption reason is stored for printing');
select public.fix_invoice_line((select id from public.invoice_lines where invoice_id = (select v from t3 where k = 'invB') limit 1), null, 'goods are exempt', true, 'Exempt agricultural produce');
select is((select tax_paise from public.invoices where id = (select v from t3 where k = 'invB')), 0::bigint, 'a line can be flagged exempt (with a reason): tax becomes 0');
select is((select original_amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invB') limit 1), 9000::bigint, 'a fixed line remembers the original amount');
select throws_ok($$ select public.fix_invoice_line((select id from public.invoice_lines where invoice_id = (select v from t3 where k = 'invB') limit 1), 1, '') $$, 'WMS08', null, 'fixing a line needs a reason');
select is((select cgst || '/' || sgst || '/' || igst from public.gst_split(50, 1800, 'INTRA', false)), '5/5/0', 'rounding: 4.5 paise rounds to 5 (each half separately)');
select is((select cgst || '/' || sgst || '/' || igst from public.gst_split(333, 1800, 'INTER', false)), '0/0/60', 'rounding: IGST 59.94 -> 60');
select is((select cgst || '/' || sgst || '/' || igst from public.gst_split(100000, 1800, 'INTRA', true)), '0/0/0', 'exempt lines carry no tax');
update public.tax_rules set gst_rate_bp = 1200 where section = 'RENT' and storage_type is null;
insert into t3 select 'invC', public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist() - 1, 'RENT_ONLY');
select is((select cgst_paise || '/' || sgst_paise || '/' || grand_total_paise from public.invoices where id = (select v from t3 where k = 'invC')), '1500/1500/28000', 'GST rate is read from the tax rules table (12 %: 5 days x 5000 global dry rate)');
select is((select amount_paise from public.invoice_lines where invoice_id = (select v from t3 where k = 'invC')), 25000::bigint, 'client C in the group uses the global dry rate');
select public.add_other_charge((select v from t3 where k = 'invC'), null, 'Late pickup penalty', 1, 10000, 'client collected late');
select is((select other_taxable_paise from public.invoices where id = (select v from t3 where k = 'invC')), 10000::bigint, 'a manual other-charge line (with reason) joins the third section');

-- ---------------------------------------------------------------------
-- G. Issue, numbering, immutability (as the administrator)
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
insert into t3 select 'issuedA', (select v from t3 where k = 'invA');
select is(public.issue_invoice((select v from t3 where k = 'invA')), 'IN/P3/' || public.financial_year_label(public.today_ist()) || '/0001', 'the first invoice gets IN/<warehouse>/<financial year>/0001');
select is(public.issue_invoice((select v from t3 where k = 'invE')), 'IN/P3/' || public.financial_year_label(public.today_ist()) || '/0002', 'numbers are sequential');
select ok(length((select invoice_no from public.invoices where id = (select v from t3 where k = 'invA'))) <= 16, 'invoice numbers fit in 16 characters');
select is((select status::text || ' ' || due_date - invoice_date from public.invoices where id = (select v from t3 where k = 'invA')), 'ISSUED 15', 'issued with the due date from the client payment terms');
select throws_ok($$ select public.issue_invoice((select v from t3 where k = 'invA')) $$, 'WMS25', null, 'an invoice cannot be issued twice');
select throws_ok($$ update public.invoices set grand_total_paise = 1 where id = (select v from t3 where k = 'invA') $$, '42501', null, 'API users have no write access to invoices at all');
reset role;
select throws_ok($$ update public.invoices set grand_total_paise = 1 where id = (select v from t3 where k = 'invA') $$, 'WMS25', null, 'an issued invoice cannot be edited, even by the database owner');
select throws_ok($$ delete from public.invoices where id = (select v from t3 where k = 'invA') $$, 'WMS25', null, 'an issued invoice cannot be deleted');
select throws_ok($$ update public.invoice_lines set amount_paise = 1 where invoice_id = (select v from t3 where k = 'invA') $$, 'WMS25', null, 'the lines of an issued invoice cannot change');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f2","role":"authenticated"}', false);
select throws_ok($$ select public.discard_draft_invoice((select v from t3 where k = 'invA'), 'x') $$, '42501', null, 'only an administrator can discard (and only drafts)');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select throws_ok($$ update public.rent_rates set rate_paise = 1 where id = (select (rate_ids)[1] from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and section = 'RENT' limit 1) $$, 'WMS21', null,
  'a rate used on an invoice cannot be edited');
select lives_ok($$ update public.rent_rates set valid_to = public.today_ist() + 30 where id = (select (rate_ids)[1] from public.invoice_lines where invoice_id = (select v from t3 where k = 'invA') and section = 'RENT' limit 1) $$,
  'but it can be closed with a valid-to date');

-- ---------------------------------------------------------------------
-- H. Credit / debit notes, payments, ledger, ageing, overdue
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
insert into t3 select 'cn1', public.issue_adjustment_note((select v from t3 where k = 'invE'), 'CREDIT', 'rate correction', '[{"section":"RENT","description":"Rate correction","taxable_paise":10000}]');
select is((select note_no from public.adjustment_notes where id = (select v from t3 where k = 'cn1')), 'CN/P3/' || public.financial_year_label(public.today_ist()) || '/0001', 'credit notes have their own numbering');
select is((select grand_total_paise || ' ' || cgst_paise from public.adjustment_notes where id = (select v from t3 where k = 'cn1')), '11200 600', 'the credit note uses the same section and tax split (rent tax rule now 12 %: 1200 -> 11200)');
select is((select credit_paise from public.invoices where id = (select v from t3 where k = 'invE')), 11200::bigint, 'the credit reduces what the invoice still owes');
select throws_ok($$ select public.issue_adjustment_note((select v from t3 where k = 'invE'), 'CREDIT', 'too much', '[{"section":"RENT","taxable_paise":900000}]') $$, 'WMS28', null, 'a credit note cannot exceed the invoice');
select throws_ok($$ update public.adjustment_notes set reason = 'x' where id = (select v from t3 where k = 'cn1') $$, '42501', null, 'notes cannot be changed through the API');
insert into t3 select 'pay1', public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 100000, 'UPI', 'UTR123', public.today_ist(), (select v from t3 where k = 'invA'));
select is((select status::text || ' ' || paid_paise from public.invoices where id = (select v from t3 where k = 'invA')), 'PARTIALLY_PAID 100000', 'a partial payment is allocated to the invoice');
select is((select payment_no from public.payments where id = (select v from t3 where k = 'pay1')), 'PY/P3/' || public.financial_year_label(public.today_ist()) || '/0001', 'payments are numbered');
select public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 359300, 'BANK_TRANSFER', 'NEFT9', public.today_ist());
select is((select status::text from public.invoices where id = (select v from t3 where k = 'invA')), 'PAID', 'the balance (FIFO, no invoice chosen) settles it');
insert into t3 select 'adv', public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 5000, 'CASH', null, public.today_ist());
select is((select amount_paise - coalesce((select sum(amount_paise)::bigint from public.payment_allocations where payment_id = p.id), 0) from public.payments p where p.id = (select v from t3 where k = 'adv')), 5000::bigint, 'with nothing open the payment stays as an advance');
select throws_ok($$ select public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 60000, 'DEPOSIT_ADJUSTMENT', null, public.today_ist()) $$, 'WMS27', null, 'a deposit adjustment cannot exceed the security deposit (500.00)');
select lives_ok($$ select public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 20000, 'DEPOSIT_ADJUSTMENT', null, public.today_ist()) $$, 'a deposit adjustment within the deposit works');
select public.reverse_payment((select v from t3 where k = 'adv'), 'entered by mistake');
select is((select status from public.payments where id = (select v from t3 where k = 'adv')), 'REVERSED', 'a payment can be reversed with a reason');
select is((select sum(debit_paise - credit_paise)::bigint from public.client_ledger('c3000000-0000-0000-0000-00000000000a')), (459300 - 100000 - 359300 - 20000)::bigint, 'the ledger running balance reflects invoices and payments');
reset role;
alter table public.invoices disable trigger invoices_guard;
update public.invoices set invoice_date = public.today_ist() - 40, due_date = public.today_ist() - 25 where id = (select v from t3 where k = 'invE');
alter table public.invoices enable trigger invoices_guard;
select is((select b31_60 from public.ageing_report() where client_id = 'c3000000-0000-0000-0000-00000000000e'), 118600::bigint, 'ageing: the 40-day-old balance falls in 31 to 60 days');
select is(public.mark_overdue_invoices(), 1, 'the cron job marks the invoice OVERDUE after its due date');
select ok((select count(*) from public.reminder_queue where invoice_id = (select v from t3 where k = 'invE')) >= 1, 'overdue reminders are queued for the Edge Function');
update public.app_settings set value = '{"enabled":true,"overdue_days":10,"block_over_credit_limit":true}' where key = 'billing_block';
select ok(public.billing_block_reason('c3000000-0000-0000-0000-00000000000e') like 'An invoice is overdue by more than 10 days', 'overdue clients can be blocked from new requests (setting)');
select public.set_billing_override('c3000000-0000-0000-0000-00000000000e', public.today_ist() + 5, 'manager asked');
select is(public.billing_block_reason('c3000000-0000-0000-0000-00000000000e'), null, 'an admin override lifts the block');
update public.clients set billing_override_until = null where id = 'c3000000-0000-0000-0000-00000000000e';
update public.app_settings set value = '{"enabled":false,"overdue_days":30,"block_over_credit_limit":true}' where key = 'billing_block';

-- ---------------------------------------------------------------------
-- I. Reports
-- ---------------------------------------------------------------------
select is((select sum(total_paise)::bigint from public.report_revenue(public.today_ist() - 1, public.today_ist(), 'client') where bucket like 'Client A%'), 459300::bigint, 'revenue by client');
select is((select rent_paise || ' ' || labour_paise from public.report_revenue(public.today_ist() - 1, public.today_ist(), 'month') limit 1), '197000 182210', 'revenue split rent vs labour (invoice A; the old invoice E is out of range; less the credit note)');
select ok((select count(*) from public.gstr1_register(public.today_ist() - 1, public.today_ist()) where category = 'B2B' and gstin = '33AABCT1332L1ZL') >= 2, 'GSTR-1 register: B2B rows with GSTIN');
select ok((select count(*) from public.gstr1_register(public.today_ist() - 1, public.today_ist()) where category = 'B2C' and doc_type = 'CREDIT_NOTE') = 1, 'GSTR-1 register: credit notes, B2C without GSTIN');
select ok((select count(*) from public.report_utilisation(public.today_ist() - 10, public.today_ist() - 1) where warehouse like 'P3%' and billed_brigade_days > 0) = 1, 'utilisation: brigade-days billed vs available');

-- ---------------------------------------------------------------------
-- J. RLS per role
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select ok((select count(*) from public.invoices) >= 6, 'the accountant sees all invoices, drafts included');
select is((select count(*)::int from public.rate_cards where scope = 'GLOBAL'), 1, 'the accountant can read rate cards');
select throws_ok($$ insert into public.rate_cards (name, scope, valid_from) values ('x', 'GLOBAL', current_date) $$, '42501', null, 'the accountant cannot write rate cards');
select throws_ok($$ select public.issue_invoice((select v from t3 where k = 'invB')) $$, '42501', null, 'the accountant cannot issue invoices');
select throws_ok($$ select public.record_payment('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 100, 'CASH', null, current_date) $$, '42501', null, 'the accountant cannot record payments');
select ok(length(public.tally_export_xml(public.today_ist() - 1, public.today_ist())) > 500, 'the accountant can export the Tally XML');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select count(*)::int from public.invoices where status = 'DRAFT'), 0, 'a manager does not see drafts');
select ok((select count(*) from public.invoices where status = 'ISSUED' or status = 'PAID' or status = 'OVERDUE' or status = 'PARTIALLY_PAID') >= 2, 'a manager sees issued invoices of their own warehouse (read only)');
select is_empty('select id from public.rate_cards', 'a manager cannot read rate cards');
select throws_ok($$ select public.generate_invoice_draft('c3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', current_date - 60, current_date - 50) $$, '42501', null, 'a manager cannot generate invoices');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select is_empty('select id from public.invoices', 'staff see no invoices');
select is_empty('select id from public.payments', 'staff see no payments');
select is_empty('select id from public.daily_occupancy', 'staff see no occupancy billing data');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select ok((select count(*) from public.invoices) >= 1 and (select count(*) from public.invoices where client_id <> 'c3000000-0000-0000-0000-00000000000a') = 0, 'a client sees only its own invoices');
select is_empty($$ select id from public.invoices where status = 'DRAFT' $$, 'a client never sees a draft');
select is((select count(distinct client_id)::int from public.payments), 1, 'a client sees only its own payments');
select ok((select count(*) from public.client_ledger('c3000000-0000-0000-0000-00000000000a')) >= 3, 'a client can read its own ledger');
select is_empty($$ select * from public.client_ledger('c3000000-0000-0000-0000-00000000000b') $$, 'but not another client''s ledger');
select ok((select count(*) from public.my_rate_summary()) >= 4, 'a client sees a summary of its own rates');
select is_empty('select id from public.rate_cards', 'a client cannot read the rate cards themselves');
select is((select value ->> 'state_code' from public.app_settings where key = 'supplier'), '33', 'a client can read the supplier details needed to print an invoice');
select is_empty($$ select key from public.app_settings where key = 'billing_block' $$, 'but not other settings');
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
select is_empty($$ select id from public.invoices where client_id = 'c3000000-0000-0000-0000-00000000000a' $$, 'client B cannot see client A''s invoices');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select id from public.invoices', '42501', null, 'anonymous users cannot read invoices');
select throws_ok('select id from public.rate_cards', '42501', null, 'anonymous users cannot read rate cards');
reset role;
select * from finish();
rollback;
