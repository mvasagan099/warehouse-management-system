-- =====================================================================
-- Phase 4 database tests: ingest, alert engine (simulated clock through the p_now argument), roll-up, evidence, affected stock,
-- lifecycle, client notices, maintenance and RLS per role. Rolled back at the end.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(128);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into public.warehouses (id, code, name) values ('a4000000-0000-0000-0000-000000000001', 'P4', 'Cold Hub'), ('a4000000-0000-0000-0000-000000000002', 'P5', 'Other Hub');
insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values
  ('d4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'Z1', 'Freezer one',   'FROZEN',  -25, -18),
  ('d4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'Z2', 'Freezer two',   'FROZEN',  -25, -18),
  ('d4000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'Z3', 'Chiller',       'CHILLED', 0, 4),
  ('d4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000001', 'Z4', 'Freezer four',  'FROZEN',  -25, -18),
  ('d4000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000001', 'Z5', 'Dry hall',      'DRY',     null, null),
  ('d4000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000002', 'ZX', 'Other freezer','FROZEN',  -25, -18);
insert into public.sensors (id, zone_id, name, type, unit, serial_no, installed_on) values
  ('51000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'Freezer one probe', 'TEMPERATURE', 'C', 'S-1', current_date),
  ('51000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000002', 'Freezer two probe', 'TEMPERATURE', 'C', 'S-2', current_date),
  ('51000000-0000-0000-0000-000000000004', 'd4000000-0000-0000-0000-000000000004', 'Freezer four probe', 'TEMPERATURE', 'C', 'S-4', current_date),
  ('51000000-0000-0000-0000-000000000005', 'd4000000-0000-0000-0000-000000000005', 'Dry door', 'DOOR', '', 'D-1', current_date),
  ('51000000-0000-0000-0000-000000000006', 'd4000000-0000-0000-0000-000000000005', 'Dry mains', 'POWER', '', 'P-1', current_date),
  ('51000000-0000-0000-0000-000000000007', 'd4000000-0000-0000-0000-000000000005', 'Dry battery sensor', 'HUMIDITY', '%', 'H-1', current_date),
  ('51000000-0000-0000-0000-000000000008', 'd4000000-0000-0000-0000-000000000006', 'Other probe', 'TEMPERATURE', 'C', 'X-1', current_date);
update public.sensors set calibration_due_at = current_date + 3 where id = '51000000-0000-0000-0000-000000000007';

insert into public.clients (id, company_name, email) values
  ('c4000000-0000-0000-0000-000000000001', 'Client One', 'c1@test.local'), ('c4000000-0000-0000-0000-000000000002', 'Client Two (left)', 'c2@test.local'),
  ('c4000000-0000-0000-0000-000000000003', 'Client Three (other zone)', null), ('c4000000-0000-0000-0000-000000000004', 'Client Four (not yet)', null),
  ('c4000000-0000-0000-0000-000000000005', 'Client Five (brigade only)', null), ('c4000000-0000-0000-0000-000000000006', 'Client Six (arrives tomorrow)', null),
  ('c4000000-0000-0000-0000-000000000007', 'Client Seven (left yesterday)', null);
insert into public.contracts (client_id, warehouse_id, start_date, status) select id, 'a4000000-0000-0000-0000-000000000001', current_date - 60, 'ACTIVE' from public.clients where id::text like 'c4000000%';
insert into public.brigade_slots (id, warehouse_id, zone_id, brigade_type_id, aisle, rack, level, position, code)
select ('b4000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'a4000000-0000-0000-0000-000000000001', z::uuid, (select id from public.brigade_types where is_default), 1, 1, 1, n, 'P4-' || n
from (values (1, 'd4000000-0000-0000-0000-000000000001'), (2, 'd4000000-0000-0000-0000-000000000001'), (3, 'd4000000-0000-0000-0000-000000000001'), (4, 'd4000000-0000-0000-0000-000000000002'),
             (5, 'd4000000-0000-0000-0000-000000000001'), (6, 'd4000000-0000-0000-0000-000000000001'), (7, 'd4000000-0000-0000-0000-000000000001'), (8, 'd4000000-0000-0000-0000-000000000001')) v(n, z);
-- allocations: C1 in Z1 for 5 days and still there; C2 left Z1 3 days ago; C3 in Z2; C4 starts in 3 days; C5 holds a Brigade without stock; C6 arrives tomorrow; C7 left yesterday (India calendar days)
insert into public.slot_allocations (client_id, warehouse_id, zone_id, slot_id, brigade_type_id, start_date, end_date)
select c::uuid, 'a4000000-0000-0000-0000-000000000001', z::uuid, s::uuid, (select id from public.brigade_types where is_default), st, en
from (values
  ('c4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', public.today_ist() - 5, null::date),
  ('c4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000002', public.today_ist() - 10, public.today_ist() - 3),
  ('c4000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000004', public.today_ist() - 5, null),
  ('c4000000-0000-0000-0000-000000000004', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000003', public.today_ist() + 3, null),
  ('c4000000-0000-0000-0000-000000000005', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000005', public.today_ist() - 5, null),
  ('c4000000-0000-0000-0000-000000000006', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000006', public.today_ist() + 1, null),
  ('c4000000-0000-0000-0000-000000000007', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000007', public.today_ist() - 8, public.today_ist() - 1)) v(c, z, s, st, en);
insert into public.stock_items (id, client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, unit, quantity, batch_no, received_at) values
  ('e4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 'P4-1', 'Frozen peas', 'BOX', 10, 'BATCH-A', now() - interval '5 days'),
  ('e4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000002', 'P4-2', 'Old fish', 'BOX', 0, 'BATCH-OLD', now() - interval '10 days'),
  ('e4000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000004', 'P4-4', 'Ice cream', 'BOX', 5, 'BATCH-Z2', now() - interval '5 days');
insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, from_slot_id, qty_delta, weight_delta, document_type, document_id, reason, created_at)
values ('OUT', 'e4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000002', -5, 0, 'DELIVERY_CHALLAN', gen_random_uuid(), 'test', now() - interval '3 days');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('a4000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-admin@test.local', '{"role":"SUPER_ADMIN"}'),
  ('a4000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-acct@test.local',  '{"role":"ACCOUNTANT"}'),
  ('a4000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-mgr@test.local',   '{"role":"WAREHOUSE_MANAGER"}'),
  ('a4000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-staff@test.local', '{"role":"STAFF","warehouse_id":"a4000000-0000-0000-0000-000000000001"}'),
  ('a4000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-c1@test.local',    '{"role":"CLIENT","client_id":"c4000000-0000-0000-0000-000000000001"}'),
  ('a4000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-c2@test.local',    '{"role":"CLIENT","client_id":"c4000000-0000-0000-0000-000000000002"}'),
  ('a4000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-staff2@test.local','{"role":"STAFF","warehouse_id":"a4000000-0000-0000-0000-000000000002"}'),
  ('a4000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-c6@test.local',    '{"role":"CLIENT","client_id":"c4000000-0000-0000-0000-000000000006"}'),
  ('a4000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4-c7@test.local',    '{"role":"CLIENT","client_id":"c4000000-0000-0000-0000-000000000007"}');
insert into public.warehouse_managers (warehouse_id, user_id) values ('a4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-0000000000f3');

-- simulated clock and helpers
create temp table t4 (k text primary key, v text);
grant all on t4 to authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
insert into t4 values ('b0', (date_trunc('minute', now()) - interval '4 hours')::text);
insert into t4 select 'key', public.create_device_key('a4000000-0000-0000-0000-000000000001', null, 'gateway');
insert into t4 select 'hash', encode(extensions.digest((select v from t4 where k = 'key'), 'sha256'), 'hex');
create function pg_temp.b0() returns timestamptz language sql as $$ select v::timestamptz from t4 where k = 'b0' $$;
create function pg_temp.h() returns text language sql as $$ select v from t4 where k = 'hash' $$;
-- post one reading per minute: sensor serial, from minute, to minute, value; the clock is the last minute
create function pg_temp.feed(p_serial text, p_from integer, p_to integer, p_val numeric) returns void language plpgsql as $$
declare m integer;
begin
  for m in p_from..p_to loop
    perform public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', p_serial, 'value', p_val, 'timestamp', pg_temp.b0() + m * interval '1 minute')), pg_temp.b0() + m * interval '1 minute');
  end loop;
end $$;
create function pg_temp.alerts_of(p_serial text, p_kind text) returns integer language sql as $$
  select count(*)::integer from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = p_serial and a.kind = p_kind::public.alert_kind $$;

-- ---------------------------------------------------------------------
-- A. Device keys and ingest
-- ---------------------------------------------------------------------
select ok((select v from t4 where k = 'key') like 'wms_%', 'a device key is shown once (wms_ prefix)');
select is((select count(*)::integer from public.device_keys where key_hash = (select v from t4 where k = 'hash')), 1, 'only the SHA-256 hash is stored');
select is((select count(*)::integer from public.device_keys where key_hash = (select v from t4 where k = 'key') or key_prefix = (select v from t4 where k = 'key')), 0, 'the plain key is not stored anywhere in device_keys');
select throws_ok($$ select public.ingest_readings(encode(extensions.digest('wms_wrong', 'sha256'), 'hex'), '[{"sensor":"S-1","value":-20}]') $$, 'WMS40', null, 'a bad device key is refused');
select is((public.ingest_readings(pg_temp.h(), '[{"sensor":"NOPE","value":-20}]', pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'unknown_sensor', 'an unknown sensor is rejected');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', 200, 'timestamp', pg_temp.b0())), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'value_out_of_range', 'an impossible value (200 C) is rejected');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -61, 'timestamp', pg_temp.b0())), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'value_out_of_range', 'below -60 C is rejected');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0() + interval '11 minutes')), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'future_timestamp', 'a timestamp more than 10 minutes ahead is rejected');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0() + interval '9 minutes')), pg_temp.b0()) ->> 'accepted')::integer, 1, 'a timestamp 9 minutes ahead is accepted (clock drift)');
delete from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'; update public.sensors set last_seen_at = null, last_value = null where id = '51000000-0000-0000-0000-000000000001';
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0() - interval '8 days')), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'too_old', 'data older than 7 days is rejected');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0() - interval '6 days')), pg_temp.b0()) ->> 'accepted')::integer, 1, 'late data (offline buffering) up to 7 days old is accepted');
delete from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'; update public.sensors set last_seen_at = null, last_value = null where id = '51000000-0000-0000-0000-000000000001';
select is(public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0())), pg_temp.b0()) ->> 'accepted', '1', 'a good reading is accepted');
select is(public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0())), pg_temp.b0()) ->> 'duplicates', '1', 'the same (sensor, timestamp) again is a duplicate, not an error');
select is((select count(*)::integer from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'), 1, 'and it is stored once (idempotent)');
select is((select last_seen_at from public.sensors where id = '51000000-0000-0000-0000-000000000001'), pg_temp.b0(), 'last_seen_at is updated on every accepted reading');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(
    jsonb_build_object('sensor', 'S-1', 'value', -19, 'timestamp', pg_temp.b0() + interval '1 minute'), jsonb_build_object('sensor', 'S-1', 'value', 999, 'timestamp', pg_temp.b0() + interval '2 minutes'),
    jsonb_build_object('sensor', 'S-1', 'value', -19, 'timestamp', pg_temp.b0() + interval '3 minutes')), pg_temp.b0() + interval '3 minutes') ->> 'accepted')::integer, 2, 'a batch with one bad row stores the good rows');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(
    jsonb_build_object('sensor', 'S-1', 'value', -19, 'timestamp', pg_temp.b0() + interval '4 minutes'), jsonb_build_object('sensor', 'S-1', 'value', 999, 'timestamp', pg_temp.b0() + interval '5 minutes')),
    pg_temp.b0() + interval '5 minutes') -> 'rejected' -> 0 ->> 'index')::integer, 1, 'and reports which row was bad (index in the batch)');
delete from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'; update public.sensors set last_seen_at = null, last_value = null where id = '51000000-0000-0000-0000-000000000001';
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'X-1', 'value', -20, 'timestamp', pg_temp.b0())), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'sensor_not_allowed', 'a key of one warehouse cannot post for another warehouse''s sensor');
select is((public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'unit', 'F', 'timestamp', pg_temp.b0())), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'unit_mismatch', 'the unit must match the sensor');
select throws_ok($$ select public.ingest_readings(pg_temp.h(), '[]'::jsonb) $$, 'WMS41', null, 'an empty batch is refused');
select throws_ok($$ select public.ingest_readings(pg_temp.h(), (select jsonb_agg(jsonb_build_object('sensor', 'S-1', 'value', -20)) from generate_series(1, 101))) $$, 'WMS41', null, 'more than 100 readings in one batch are refused');
select throws_ok($$ select public.ingest_readings(pg_temp.h(), '{"sensor":"S-1"}'::jsonb) $$, 'WMS41', null, 'the payload must be an array');
insert into t4 select 'skey', public.create_device_key(null, '51000000-0000-0000-0000-000000000002', 'S-2 only');
select is((public.ingest_readings(encode(extensions.digest((select v from t4 where k = 'skey'), 'sha256'), 'hex'), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -20, 'timestamp', pg_temp.b0())), pg_temp.b0()) -> 'rejected' -> 0 ->> 'reason'), 'sensor_not_allowed', 'a per-sensor key works for that sensor only');
insert into t4 select 'rkey', public.rotate_device_key((select id from public.device_keys where key_hash = encode(extensions.digest((select v from t4 where k = 'skey'), 'sha256'), 'hex')));
select throws_ok(format($$ select public.ingest_readings(%L, '[{"sensor":"S-2","value":-20}]') $$, encode(extensions.digest((select v from t4 where k = 'skey'), 'sha256'), 'hex')), 'WMS40', null, 'a rotated key stops working');
select is((public.ingest_readings(encode(extensions.digest((select v from t4 where k = 'rkey'), 'sha256'), 'hex'), jsonb_build_array(jsonb_build_object('sensor', 'S-2', 'value', -20, 'timestamp', pg_temp.b0())), pg_temp.b0()) ->> 'accepted')::integer, 1, 'and the new key works');
select public.revoke_device_key((select id from public.device_keys where key_hash = encode(extensions.digest((select v from t4 where k = 'rkey'), 'sha256'), 'hex')));
select throws_ok(format($$ select public.ingest_readings(%L, '[{"sensor":"S-2","value":-20}]') $$, encode(extensions.digest((select v from t4 where k = 'rkey'), 'sha256'), 'hex')), 'WMS40', null, 'a revoked key is refused');
delete from public.readings where sensor_id = '51000000-0000-0000-0000-000000000002'; update public.sensors set last_seen_at = null, last_value = null where id = '51000000-0000-0000-0000-000000000002';

-- calibration offset is applied to the shown value and the raw value is kept
select public.record_calibration('51000000-0000-0000-0000-000000000001', public.today_ist(), -20.0, -19.2, null, 'test');
select is((select calibration_offset from public.sensors where id = '51000000-0000-0000-0000-000000000001'), -0.80, 'calibration stores the offset (reference minus sensor reading)');
select public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'S-1', 'value', -19, 'timestamp', pg_temp.b0())), pg_temp.b0());
select is((select value || ' ' || raw_value from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'), '-19.80 -19.00', 'the offset is applied to the displayed value; the raw value is kept');
delete from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001'; update public.sensors set last_seen_at = null, last_value = null, calibration_offset = 0 where id = '51000000-0000-0000-0000-000000000001';
select is((select calibration_due_at - last_calibrated_at from public.sensors where id = '51000000-0000-0000-0000-000000000001'), 365, 'the next calibration date comes from the settings (365 days)');

-- ---------------------------------------------------------------------
-- B. Alert engine: independent scenarios first (door, power, humidity/battery/calibration, offline, defrost)
-- ---------------------------------------------------------------------
select pg_temp.feed('D-1', 0, 6, 1);
select public.evaluate_alerts(pg_temp.b0() + interval '4 minutes');
select is(pg_temp.alerts_of('D-1', 'DOOR_OPEN'), 0, 'a door open for 4 minutes does not alert (blip ignored)');
select public.evaluate_alerts(pg_temp.b0() + interval '6 minutes');
select is(pg_temp.alerts_of('D-1', 'DOOR_OPEN'), 1, 'a door open longer than the configured minutes alerts');
select pg_temp.feed('P-1', 0, 0, 0);
select public.evaluate_alerts(pg_temp.b0());
select is((select a.severity::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'P-1' and a.kind = 'POWER_FAILURE'), 'CRITICAL', 'a power failure alerts at once as CRITICAL');
select public.ingest_readings(pg_temp.h(), jsonb_build_array(jsonb_build_object('sensor', 'H-1', 'value', 50, 'battery', 12, 'timestamp', pg_temp.b0())), pg_temp.b0());
select public.evaluate_alerts(pg_temp.b0());
select is(pg_temp.alerts_of('H-1', 'BATTERY_LOW'), 1, 'a low battery alerts');
select is(pg_temp.alerts_of('H-1', 'CALIBRATION_DUE'), 1, 'calibration due within 7 days alerts');
update public.alert_rules set enabled = enabled where false;
insert into public.alert_rules (zone_id, humidity_min, humidity_max, humidity_delay_min) values ('d4000000-0000-0000-0000-000000000005', 30, 60, 5);
select pg_temp.feed('H-1', 1, 8, 80);
select public.evaluate_alerts(pg_temp.b0() + interval '8 minutes');
select is(pg_temp.alerts_of('H-1', 'HUMIDITY'), 1, 'humidity out of the zone range for the delay alerts');

select pg_temp.feed('S-4', 0, 0, -20);
select public.evaluate_alerts(pg_temp.b0() + interval '14 minutes');
select is(pg_temp.alerts_of('S-4', 'OFFLINE'), 0, 'a sensor silent for 14 minutes is not yet offline (15 minute setting)');
select public.evaluate_alerts(pg_temp.b0() + interval '16 minutes');
select is(pg_temp.alerts_of('S-4', 'OFFLINE'), 1, 'a sensor silent longer than the setting raises an OFFLINE alert');
select pg_temp.feed('S-4', 17, 17, -20);
select public.evaluate_alerts(pg_temp.b0() + interval '17 minutes');
select isnt((select a.recovered_at from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-4' and a.kind = 'OFFLINE'), null, 'the OFFLINE alert closes by itself when readings return');

-- peak deviation alone makes it CRITICAL: Z4 jumps 8 C above the limit
select pg_temp.feed('S-4', 40, 51, -10);
select public.evaluate_alerts(pg_temp.b0() + interval '51 minutes');
select is((select a.severity::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-4' and a.kind = 'TEMP_HIGH'), 'CRITICAL', 'more than 5 C beyond the limit is CRITICAL straight away');

-- defrost window: Z2 warm readings inside the window are ignored
insert into public.defrost_windows (zone_id, name, start_time, end_time) values ('d4000000-0000-0000-0000-000000000002', 'Morning defrost',
  ((pg_temp.b0() at time zone 'Asia/Kolkata')::time - interval '30 minutes')::time, ((pg_temp.b0() at time zone 'Asia/Kolkata')::time + interval '3 hours')::time);
select is(public.in_defrost('d4000000-0000-0000-0000-000000000002', pg_temp.b0() + interval '20 minutes'), true, 'a defrost window is recognised (India time)');
select pg_temp.feed('S-2', 0, 40, -10);
select public.evaluate_alerts(pg_temp.b0() + interval '40 minutes');
select is(pg_temp.alerts_of('S-2', 'TEMP_HIGH'), 0, 'high readings inside a defrost window raise no alert');
select pg_temp.feed('S-2', 41, 60, -10);
select public.evaluate_alerts(pg_temp.b0() + interval '60 minutes');
select is(pg_temp.alerts_of('S-2', 'TEMP_HIGH'), 0, 'still no alert at the edge of the window');
select pg_temp.feed('S-2', 200, 230, -10);                  -- 3h20 later: outside the 3h30 window? (window ends at +3h) so these are breaches
select public.evaluate_alerts(pg_temp.b0() + interval '230 minutes');
select is(pg_temp.alerts_of('S-2', 'TEMP_HIGH'), 1, 'the same readings after the window do alert');

-- ---------------------------------------------------------------------
-- C. Alert engine on Z1: tolerance, delay, duplicates, escalation, recovery, evidence, notifications
-- ---------------------------------------------------------------------
select pg_temp.feed('S-1', 0, 19, -20);
select public.evaluate_alerts(pg_temp.b0() + interval '19 minutes');
select is(pg_temp.alerts_of('S-1', 'TEMP_HIGH') + pg_temp.alerts_of('S-1', 'TEMP_LOW'), 0, 'readings inside the limits raise nothing');
select pg_temp.feed('S-1', 20, 29, -17);
select public.evaluate_alerts(pg_temp.b0() + interval '29 minutes');
select is(pg_temp.alerts_of('S-1', 'TEMP_HIGH'), 0, 'readings above the limit but inside the tolerance (2 C) raise nothing');
select pg_temp.feed('S-1', 30, 38, -15);
select public.evaluate_alerts(pg_temp.b0() + interval '38 minutes');
select is(pg_temp.alerts_of('S-1', 'TEMP_HIGH'), 0, 'out of tolerance for 8 minutes: still inside the 10 minute delay, no alert');
select pg_temp.feed('S-1', 39, 40, -15);
select public.evaluate_alerts(pg_temp.b0() + interval '40 minutes');
select is((select a.severity::text || ' ' || a.peak_deviation from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'WARNING 3.00', 'after the delay a WARNING opens with the peak deviation');
select public.evaluate_alerts(pg_temp.b0() + interval '40 minutes');
select public.evaluate_alerts(pg_temp.b0() + interval '41 minutes');
select is(pg_temp.alerts_of('S-1', 'TEMP_HIGH'), 1, 'evaluating again never opens a duplicate alert for the same breach');
select is((select count(*)::integer from public.alert_evidence e join public.alerts a on a.id = e.alert_id join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 41,
  'evidence copies the raw readings from 30 minutes before the event up to now');
select pg_temp.feed('S-1', 41, 60, -15);
select public.evaluate_alerts(pg_temp.b0() + interval '60 minutes');
select is((select a.severity::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'CRITICAL', 'the alert escalates to CRITICAL by duration (30 minutes)');
select ok((select count(*) from public.notifications n where n.user_id = 'a4000000-0000-0000-0000-0000000000f4' and n.kind = 'ALERT') >= 2, 'warehouse staff got an in-app notification for the alert and for the escalation to CRITICAL');
select ok((select count(*) from public.notification_outbox where to_address = 'p4-staff@test.local' and channel = 'EMAIL') >= 1, 'an email is queued for the Edge Function');
select is((select count(*)::integer from public.notification_outbox where channel in ('WHATSAPP', 'SMS')), 0, 'WhatsApp and SMS stay off behind their feature flags');
select pg_temp.feed('S-1', 61, 75, -15);
select public.evaluate_alerts(pg_temp.b0() + interval '75 minutes');
select is((select a.escalation_level from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 1, 'a CRITICAL alert nobody acknowledged goes to the next person (manager)');
select ok((select count(*) from public.notifications where user_id = 'a4000000-0000-0000-0000-0000000000f3' and kind = 'ALERT') >= 1, 'the manager was notified');
select pg_temp.feed('S-1', 76, 90, -15);
select public.evaluate_alerts(pg_temp.b0() + interval '90 minutes');
select is((select a.escalation_level from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 2, 'still not acknowledged: it escalates to the administrator');
select ok((select count(*) from public.notifications where user_id = 'a4000000-0000-0000-0000-0000000000f1' and kind = 'ALERT') >= 1, 'the administrator was notified');
select pg_temp.feed('S-1', 91, 95, -20);
select public.evaluate_alerts(pg_temp.b0() + interval '94 minutes');
select is((select a.recovered_at from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), null, 'readings back in range for less than the recovery time do not close the alert');
select pg_temp.feed('S-1', 96, 100, -20);
select public.evaluate_alerts(pg_temp.b0() + interval '100 minutes');
select is((select a.recovered_at from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), pg_temp.b0() + interval '91 minutes', 'the alert closes itself with recovered_at = the first reading back in range');
select is((select a.duration_min from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 61, 'the duration is event start to recovery (61 minutes)');
select is((select a.status::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'OPEN', 'recovery does not resolve it: a person still has to acknowledge and resolve');
select is((select count(*)::integer from public.alert_evidence e join public.alerts a on a.id = e.alert_id join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 92, 'at recovery the evidence covers the event: from 30 minutes before it up to the recovery (minutes 0..91)');
select is((select a.peak_value from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), -15.00, 'the peak value is recorded');

-- ---------------------------------------------------------------------
-- D. Affected stock, client notices
-- ---------------------------------------------------------------------
select is((select string_agg(distinct client_name, ', ' order by client_name) from public.alert_stock s join public.alerts a on a.id = s.alert_id join public.sensors se on se.id = a.sensor_id where se.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'),
  'Client Five (brigade only), Client One', 'affected stock lists exactly the clients present in the zone during the event (not the one that left, the other zone, or the one arriving later)');
select is((select string_agg(coalesce(batch_no, 'none'), ',' order by client_name) from public.alert_stock s join public.alerts a on a.id = s.alert_id join public.sensors se on se.id = a.sensor_id where se.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'),
  'none,BATCH-A', 'with the batch of Client One and the Brigade-only client without a batch');
select is((select count(*)::integer from public.affected_stock('d4000000-0000-0000-0000-000000000001', now() - interval '1 hour', now())), 2, 'affected_stock for the zone and window returns the same two rows');
select is((select count(*)::integer from public.client_notices n join public.alerts a on a.id = n.alert_id join public.sensors se on se.id = a.sensor_id where se.serial_no = 'S-1'), 2, 'one draft client notice per affected client, none for the others');
select is((select count(*)::integer from public.notification_outbox where to_address = 'c1@test.local'), 0, 'no client email is sent before a manager approves');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select throws_ok($$ select public.approve_client_notice((select n.id from public.client_notices n where n.client_id = 'c4000000-0000-0000-0000-000000000001')) $$, '42501', null, 'staff cannot approve a client notice');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
select public.approve_client_notice((select n.id from public.client_notices n where n.client_id = 'c4000000-0000-0000-0000-000000000001'), null, 'Approved wording for Client One');
select is((select body from public.notification_outbox where to_address = 'c1@test.local'), 'Approved wording for Client One', 'after the manager approves (and edits) the wording the client email is queued');
select is((select count(*)::integer from public.notifications where user_id = 'a4000000-0000-0000-0000-0000000000f5' and kind = 'CLIENT_NOTICE'), 1, 'and the client gets an in-app notice');

-- ---------------------------------------------------------------------
-- E. Lifecycle: acknowledge, resolve, equipment link, manual readings
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select public.acknowledge_alert((select a.id from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'));
select is((select a.status::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'ACKNOWLEDGED', 'staff can acknowledge an alert');
select throws_ok($$ select public.acknowledge_alert((select a.id from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH')) $$, 'WMS03', null, 'an alert cannot be acknowledged twice');
select throws_ok($$ select public.resolve_alert((select a.id from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'x', 'y') $$, '42501', null, 'staff cannot resolve an alert');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
insert into public.equipment (id, warehouse_id, zone_id, type, name, service_interval_days) values ('f4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'COMPRESSOR', 'Compressor A', 30);
select throws_ok($$ select public.resolve_alert((select a.id from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), '', 'did something') $$, 'WMS08', null, 'resolving needs a cause');
select public.resolve_alert((select a.id from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'Compressor fault', 'Restarted the compressor', 'f4000000-0000-0000-0000-000000000001', true, public.today_ist() + 2);
select is((select a.status::text || ' ' || a.equipment_id::text from public.alerts a join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 'RESOLVED f4000000-0000-0000-0000-000000000001', 'a manager resolves it with cause and action and links the equipment');
select is((select count(*)::integer from public.maintenance_tasks where alert_id is not null and equipment_id = 'f4000000-0000-0000-0000-000000000001'), 1, 'a machine-fault cause creates a maintenance task linked to the alert');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select public.add_manual_reading('d4000000-0000-0000-0000-000000000003', 9.5, null, 'checked with probe');
select is((select source::text from public.readings r join public.sensors s on s.id = r.sensor_id where s.zone_id = 'd4000000-0000-0000-0000-000000000003'), 'MANUAL', 'a manual reading is stored with source MANUAL');
select is((select recorded_by from public.readings r join public.sensors s on s.id = r.sensor_id where s.zone_id = 'd4000000-0000-0000-0000-000000000003'), 'a4000000-0000-0000-0000-0000000000f4'::uuid, 'and the staff user');
select public.evaluate_alerts(clock_timestamp() + interval '1 second');
select is((select count(*)::integer from public.alerts where zone_id = 'd4000000-0000-0000-0000-000000000003' and kind = 'TEMP_HIGH'), 1, 'a manual reading feeds the alert engine too (opens immediately: no sensor delay)');
select throws_ok($$ select public.add_manual_reading('d4000000-0000-0000-0000-000000000003', 500) $$, 'WMS43', null, 'an impossible manual value is refused');
select throws_ok($$ select public.add_manual_reading('d4000000-0000-0000-0000-000000000006', 1) $$, '42501', null, 'staff cannot add readings for another warehouse');

-- maintenance reminders and completion
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
insert into public.maintenance_tasks (id, equipment_id, due_date, assigned_to, title) values ('fa000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', public.today_ist() + 7, 'a4000000-0000-0000-0000-0000000000f4', 'Quarterly service');
select is(public.maintenance_reminders(), 3, 'tasks due within 7 days notify the assignee and the manager (the alert repair task too)');
select is(public.maintenance_reminders(), 0, 'and does not notify twice');
update public.maintenance_tasks set due_date = public.today_ist() + 1 where id = 'fa000000-0000-0000-0000-000000000001';
select is(public.maintenance_reminders(), 2, 'a second reminder goes out 1 day before');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select public.complete_maintenance_task('fa000000-0000-0000-0000-000000000001', 'done', array['p.jpg']);
select is((select last_service_on from public.equipment where id = 'f4000000-0000-0000-0000-000000000001'), public.today_ist(), 'staff complete a task: the service history is updated');
select is((select count(*)::integer from public.maintenance_tasks where equipment_id = 'f4000000-0000-0000-0000-000000000001' and status = 'OPEN' and title = 'Scheduled service'), 1, 'and the next service task is scheduled from the interval');
select throws_ok($$ select public.update_maintenance_task((select id from public.maintenance_tasks where title = 'Scheduled service'), 'CANCELLED') $$, '42501', null, 'staff cannot cancel a maintenance task');

-- ---------------------------------------------------------------------
-- F. Reports
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select is((select worst_severity from public.cold_chain_overview('a4000000-0000-0000-0000-000000000002') where zone_code = 'ZX'), null, 'a zone without open alerts has no alert severity (the tile is not shown as WARNING)');
select is((select worst_severity from public.cold_chain_overview('a4000000-0000-0000-0000-000000000001') where zone_code = 'Z4'), 'CRITICAL', 'a zone with an open CRITICAL alert reports CRITICAL');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
select is((select min_c || ' ' || max_c || ' ' || readings || ' ' || minutes_out::integer from public.client_temperature_report('c4000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist()) where zone_code = 'Z1'),
  '-20.00 -15.00 101 71', 'client report: min, max, readings and minutes out of range for the zone and the allocation period (71 readings above -18 C, one minute each)');
select is((select count(*)::integer from public.client_temperature_report('c4000000-0000-0000-0000-000000000001', public.today_ist() - 5, public.today_ist())), 1, 'the report has one row per zone and allocation period of that client only');
select throws_ok($$ select * from public.client_temperature_report('c4000000-0000-0000-0000-000000000002', current_date - 5, current_date) $$, '42501', null, 'a client cannot run the report for another client');
select ok((select count(*) from public.zone_series('d4000000-0000-0000-0000-000000000001', now() - interval '6 hours', now(), 15)) > 0, 'a client can chart its own zone for the days its stock was there');

-- ---------------------------------------------------------------------
-- G. RLS per role
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select ok((select count(*) from public.readings) > 100, 'client one sees readings of the zone it is stored in');
select is((select count(*)::integer from public.readings where sensor_id = '51000000-0000-0000-0000-000000000002'), 0, 'but not readings of a zone it has no stock in');
select ok((select count(*) from public.alerts) >= 1 and (select count(*) from public.alerts a where a.zone_id <> 'd4000000-0000-0000-0000-000000000001') = 0, 'it sees alerts only where its own stock was affected');
select is((select count(*)::integer from public.sensors), 0, 'a client cannot read the sensors table');
select is((select count(*)::integer from public.device_keys), 0, 'nor device keys');
select is((select count(*)::integer from public.alert_stock where client_id <> 'c4000000-0000-0000-0000-000000000001'), 0, 'and sees only its own rows of the affected stock');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
select is((select count(*)::integer from public.readings), 0, 'client two (stock left 3 days ago) sees no readings from after it left');
select is((select count(*)::integer from public.alerts), 0, 'and no alerts');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f8","role":"authenticated"}', true);
select is((select count(*)::integer from public.readings), 0, 'a client whose stock arrives tomorrow sees no readings from before it arrived');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f9","role":"authenticated"}', true);
select is((select count(*)::integer from public.readings), 0, 'a client whose stock left yesterday sees no readings after it left');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select ok((select count(*) from public.readings) > 100 and (select count(*) from public.sensors) > 3, 'staff see the readings and sensors of their warehouse');
select is((select count(*)::integer from public.sensors where warehouse_id = 'a4000000-0000-0000-0000-000000000002'), 0, 'but not another warehouse');
select throws_ok($$ insert into public.alert_rules (zone_id, delay_min) values ('d4000000-0000-0000-0000-000000000003', 1) $$, '42501', null, 'staff cannot create alert rules');
with u as (update public.alert_rules set delay_min = 1 returning 1) select is((select count(*)::integer from u), 0, 'staff cannot change alert rules');
select throws_ok($$ insert into public.sensors (zone_id, name, serial_no) values ('d4000000-0000-0000-0000-000000000001', 'x', 'X-9') $$, '42501', null, 'staff cannot register sensors');
select throws_ok($$ select public.create_device_key(null, '51000000-0000-0000-0000-000000000001', 'x') $$, '42501', null, 'staff cannot create device keys');
select throws_ok($$ select public.record_calibration('51000000-0000-0000-0000-000000000001', current_date, -20, -20) $$, '42501', null, 'staff cannot record a calibration');
select throws_ok($$ insert into public.readings (sensor_id, recorded_at, value, raw_value) values ('51000000-0000-0000-0000-000000000001', now(), 1, 1) $$, '42501', null, 'nobody writes readings through the API: only the ingest function does');
select throws_ok($$ select public.ingest_readings('x', '[{}]') $$, '42501', null, 'the ingest function is not callable by signed-in users');
select throws_ok($$ select * from public.readings_y2026m11 $$, '42501', null, 'readings partitions are not reachable by name');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f7","role":"authenticated"}', true);
select is((select count(*)::integer from public.readings) + (select count(*)::integer from public.alerts) + (select count(*)::integer from public.sensors where warehouse_id <> 'a4000000-0000-0000-0000-000000000002'), 0, 'staff of another warehouse see nothing of this one');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select lives_ok($$ insert into public.alert_rules (zone_id, delay_min) values ('d4000000-0000-0000-0000-000000000003', 5) $$, 'the warehouse manager can set alert rules');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select is((select count(*)::integer from public.readings) + (select count(*)::integer from public.sensors) + (select count(*)::integer from public.alerts) + (select count(*)::integer from public.equipment), 0, 'an accountant has no access to the cold-chain module');
select throws_ok($$ select public.add_manual_reading('d4000000-0000-0000-0000-000000000003', 3) $$, '42501', null, 'and cannot add readings');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select ok((select count(*) from public.device_keys) >= 1 and (select count(*) from public.audit_logs where table_name in ('alert_rules', 'device_keys', 'calibration_log', 'alerts')) >= 4, 'the administrator sees device keys, and rule, key, calibration and alert changes are in the audit log');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select count(*) from public.readings', '42501', null, 'anonymous users cannot read readings');
reset role;

-- ---------------------------------------------------------------------
-- H. Roll-up (last: it removes the raw rows)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
create temp table before_roll as select date_trunc('hour', recorded_at) h, min(value) mn, max(value) mx, round(avg(value), 2) av, count(*)::integer n
  from public.readings where sensor_id = '51000000-0000-0000-0000-000000000001' group by 1;
create temp table ev_before as select count(*)::integer n from public.alert_evidence;
select ok((public.rollup_readings(now() + interval '40 days') ->> 'raw_deleted')::integer > 100, 'the roll-up deletes raw readings older than the retention days');
select is((select count(*)::integer from public.readings where recorded_at < now() + interval '10 days'), 0, 'no raw rows remain before the cut-off');
select is((select count(*)::integer from before_roll b join public.readings_hourly h on h.sensor_id = '51000000-0000-0000-0000-000000000001' and h.hour = b.h
            where h.min_value = b.mn and h.max_value = b.mx and h.avg_value = b.av and h.n = b.n), (select count(*)::integer from before_roll), 'hourly min, max, average and count are exactly right');
select ok((select count(*)::integer from public.alert_evidence) >= (select n from ev_before), 'the roll-up loses no alert evidence (it only adds the rows of alerts still running)');
select is((select count(*)::integer from public.alert_evidence e join public.alerts a on a.id = e.alert_id join public.sensors s on s.id = a.sensor_id where s.serial_no = 'S-1' and a.kind = 'TEMP_HIGH'), 92, 'the evidence of the excursion is still complete');
select is((select count(*)::integer from cron.job where jobname in ('wms-evaluate-alerts', 'wms-readings-rollup', 'wms-maintenance-reminders', 'wms-notify-dispatch')), 4, 'the four cold-chain jobs are scheduled');
select is((select count(*)::integer from pg_tables where schemaname = 'public' and not rowsecurity), 0, 'every public table, partitions included, has row level security');
select is((select count(*)::integer from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('sensors', 'alerts', 'notifications')), 3, 'sensors, alerts and notifications are published to Realtime');

select * from finish();
rollback;
