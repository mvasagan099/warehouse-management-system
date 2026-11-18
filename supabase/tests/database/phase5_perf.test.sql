-- Phase 5 performance check: reports answer within 3 seconds with 100,000 rows in each big table. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into public.warehouses (id, code, name) values ('a7000000-0000-0000-0000-000000000001', 'PF', 'Perf Hub');
insert into public.zones (id, warehouse_id, code, name, storage_type, temp_min, temp_max) values ('d7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Z1', 'Freezer', 'FROZEN', -25, -18);
insert into public.brigade_slots (id, warehouse_id, zone_id, brigade_type_id, aisle, rack, level, position, code) values
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', (select id from public.brigade_types where is_default), 1, 1, 1, 1, 'PF-S1');
insert into public.clients (id, code, company_name) select ('c7000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'PF' || g, 'Perf client ' || g from generate_series(1, 20) g;
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values ('a7000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pf-admin@test.local', '{"role":"SUPER_ADMIN"}');

set session_replication_role = replica;   -- bulk load without the audit triggers (this test is about report speed)
-- 100,000 stock rows, 100,000 movements, 100,000 labour rows spread over 400 days and 20 clients
insert into public.stock_items (client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, unit, quantity, batch_no, expiry_date, received_at)
select ('c7000000-0000-0000-0000-' || lpad((1 + g % 20)::text, 12, '0'))::uuid, 'a7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'PF-S1', 'Item ' || (g % 500), 'BOX', 1 + g % 50, 'B' || (g % 300), current_date + (g % 400), now() - (g % 400) * interval '1 day'
from generate_series(1, 100000) g;
insert into public.stock_movements (movement_type, stock_item_id, client_id, warehouse_id, to_slot_id, qty_delta, weight_delta, document_type, created_at)
select 'IN', (select id from public.stock_items limit 1), ('c7000000-0000-0000-0000-' || lpad((1 + g % 20)::text, 12, '0'))::uuid, 'a7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 1 + g % 9, 10, 'INWARD_RECEIPT', now() - (g % 400) * interval '1 day'
from generate_series(1, 100000) g;
insert into public.labour_entries (warehouse_id, client_id, document_type, document_id, activity, workers, hours, created_at)
select 'a7000000-0000-0000-0000-000000000001', ('c7000000-0000-0000-0000-' || lpad((1 + g % 20)::text, 12, '0'))::uuid, 'INWARD_RECEIPT', gen_random_uuid(), 'UNLOADING', 1 + g % 5, 1, now() - (g % 400) * interval '1 day'
from generate_series(1, 100000) g;
set session_replication_role = origin;
analyze public.stock_items; analyze public.stock_movements; analyze public.labour_entries;

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
set local role authenticated;
create temp table timing (k text, ms numeric); grant all on timing to authenticated;
create function pg_temp.timed(p_report text, p_from date, p_to date, p_client uuid default null) returns bigint language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); r jsonb;
begin r := public.report_rows(p_report, p_from, p_to, null, p_client, 100, 0); insert into timing values (p_report || coalesce(p_client::text, ''), extract(milliseconds from clock_timestamp() - t0)); return (r ->> 'total')::bigint; end $$;

select is(pg_temp.timed('stock', null, null), 100000::bigint, 'stock report counts every row');
select is(pg_temp.timed('movements', current_date - 30, current_date) > 0, true, 'movements report for a month has rows');
select is(pg_temp.timed('labour', current_date - 400, current_date), 100000::bigint, 'labour report counts every row');
select ok(pg_temp.timed('expiry', current_date, current_date + 30) > 0, 'expiry report for the next 30 days has rows');
select ok(pg_temp.timed('movements', null, null, 'c7000000-0000-0000-0000-000000000003') > 0, 'one client movements');
select ok((select ms from timing where k = 'stock') < 3000, 'stock report under 3 seconds with 100,000 rows');
select ok((select ms from timing where k = 'movements') < 3000, 'movements report under 3 seconds');
select ok((select ms from timing where k = 'labour') < 3000, 'labour report under 3 seconds');
select ok((select ms from timing where k = 'expiry') < 3000, 'expiry report under 3 seconds');
select ok((select max(ms) from timing) < 3000, 'every report under 3 seconds (slowest: see test output)');
select is(jsonb_array_length(public.report_rows('stock', null, null, null, null, 100, 0) -> 'rows'), 100, 'a page is 100 rows');
select throws_ok($$ select public.report_rows('nope', null, null) $$, 'WMS57', null, 'unknown report is refused');

select diag('slowest report: ' || (select k || ' ' || round(ms) || ' ms' from timing order by ms desc limit 1));
select * from finish();
rollback;
