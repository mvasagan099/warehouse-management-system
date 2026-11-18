-- Phase 5 HR tests: hiring, employees, sensitive data, attendance, corrections, manager assignment, crew log, storage policy.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(44);

insert into public.warehouses (id, code, name, latitude, longitude) values
  ('a5000000-0000-0000-0000-000000000001', 'H1', 'HR Hub', 13.082700, 80.270700),
  ('a5000000-0000-0000-0000-000000000002', 'H2', 'HR Other', 11.000000, 77.000000);
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data) values
  ('a5000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-admin@test.local', '{"role":"SUPER_ADMIN"}'),
  ('a5000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-mgr@test.local',   '{"role":"WAREHOUSE_MANAGER"}'),
  ('a5000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-staff@test.local', '{"role":"STAFF","warehouse_id":"a5000000-0000-0000-0000-000000000001"}'),
  ('a5000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-staff2@test.local','{"role":"STAFF","warehouse_id":"a5000000-0000-0000-0000-000000000001"}'),
  ('a5000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-staff3@test.local','{"role":"STAFF","warehouse_id":"a5000000-0000-0000-0000-000000000002"}'),
  ('a5000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h-mgr2@test.local',  '{"role":"WAREHOUSE_MANAGER"}');
insert into public.warehouse_managers (warehouse_id, user_id) values ('a5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000f3');

-- A. employees and hiring
select is((select count(*)::int from public.employees where user_id in (select id from auth.users where email like 'h-%@test.local')), 5, 'every staff and manager profile gets an employee record');
insert into public.vacancies (id, warehouse_id, title, job_role) values ('a5000000-0000-0000-0000-0000000000c1', 'a5000000-0000-0000-0000-000000000001', 'Loader', 'PICKER');
insert into public.vacancy_salaries values ('a5000000-0000-0000-0000-0000000000c1', 1200000, 1800000);
insert into public.applicants (id, vacancy_id, full_name) values ('a5000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-0000000000c1', 'New Joiner');
select throws_ok($$ update public.applicants set status = 'JOINED' where id = 'a5000000-0000-0000-0000-0000000000a1' $$, 'WMS50', null, 'JOINED needs a login');
select lives_ok($$ update public.applicants set status = 'SHORTLISTED' where id = 'a5000000-0000-0000-0000-0000000000a1' $$, 'SHORTLISTED is a valid status');
update public.applicants set user_id = 'a5000000-0000-0000-0000-0000000000f5', status = 'JOINED', expected_joining = '2026-12-01' where id = 'a5000000-0000-0000-0000-0000000000a1';
select is((select job_role::text || ',' || joining_date::text from public.employees where user_id = 'a5000000-0000-0000-0000-0000000000f5'), 'PICKER,2026-12-01', 'JOINED fills the employee record from the vacancy');
select is((select applicant_id::text from public.employees where user_id = 'a5000000-0000-0000-0000-0000000000f5'), 'a5000000-0000-0000-0000-0000000000a1', 'employee is linked to the applicant');

-- B. sensitive data
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
insert into public.employee_private (employee_id, id_proof_type, id_proof_path, bank_account_no, bank_ifsc, bank_account_holder)
select id, 'AADHAAR', 'idproof/x/a.pdf', '123456789012', 'HDFC0001234', 'Staff A' from public.employees where user_id = 'a5000000-0000-0000-0000-0000000000f4';
select is((select count(*)::int from public.audit_logs where table_name = 'employee_private' and new_data::text like '%123456789012%'), 0, 'bank account number never appears in the audit log');
select is((select new_data ->> 'bank_account_no' from public.audit_logs where table_name = 'employee_private' order by id desc limit 1), '***', 'it is masked instead');
select is((select count(*)::int from public.audit_logs where table_name = 'employee_private' and new_data::text like '%idproof/x%'), 0, 'ID proof path is masked too');
set local role authenticated;
select is((select count(*)::int from public.employee_private), 1, 'admin reads employee_private');
select is((select count(*)::int from public.vacancy_salaries), 1, 'admin reads salary ranges');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
select is((select count(*)::int from public.employee_private), 0, 'manager cannot read bank or ID proof');
select is((select count(*)::int from public.vacancy_salaries), 0, 'manager cannot read salary ranges');
select is((select count(*)::int from public.employees), 3, 'manager sees employees of their own warehouse only (own record + 2 staff)');
select throws_ok($$ insert into public.employee_private (employee_id) select id from public.employees limit 1 $$, '42501', null, 'manager cannot write employee_private');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select is((select count(*)::int from public.employees), 1, 'staff sees only their own employee record');
select is((select count(*)::int from public.employee_private), 0, 'staff cannot read employee_private');
reset role;

-- C. attendance
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
select is((public.check_in(13.0828, 80.2708) ->> 'gps_ok')::boolean, true, 'check-in beside the warehouse passes the GPS check');
select is((public.check_in(13.0828, 80.2708) ->> 'status'), 'ALREADY', 'a second check-in is idempotent (offline sync safe)');
select is((public.check_out(13.0828, 80.2708) ->> 'status'), 'OK', 'check-out works');
select is((public.check_out() ->> 'status'), 'ALREADY', 'a second check-out is idempotent');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
select is((public.check_in(12.0, 79.0) ->> 'gps_ok')::boolean, false, 'check-in far away is recorded as outside the GPS radius');
select throws_ok($$ select public.check_out(null, null, now() - interval '3 hours') $$, 'WMS52', null, 'check-out before check-in time is rejected');
select throws_ok($$ select public.check_in(null, null, now() + interval '1 hour') $$, 'WMS52', null, 'future time is rejected');
select throws_ok($$ select public.check_in(null, null, now() - interval '3 days') $$, 'WMS52', null, 'very old time is rejected');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
update public.app_settings set value = jsonb_set(value, '{gps_required}', 'true') where key = 'hr';
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f6","role":"authenticated"}', false);
select throws_ok($$ select public.check_in(13.0828, 80.2708) $$, 'WMS53', null, 'with GPS required, a staff member at the wrong warehouse is refused');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
update public.app_settings set value = jsonb_set(value, '{gps_required}', 'false') where key = 'hr';
select throws_ok($$ select public.check_in() $$, 'WMS03', null, 'an administrator does not record attendance');

-- D. corrections
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
create temp table t5 (k text primary key, v text); grant all on t5 to authenticated;
insert into t5 select 'corr', public.request_attendance_correction(public.today_ist() - 1, now() - interval '30 hours', now() - interval '22 hours', 'Forgot to check in');
select throws_ok($$ select public.request_attendance_correction(public.today_ist(), now(), null, '') $$, 'WMS55', null, 'a correction needs a reason');
select throws_ok($$ select public.decide_attendance_correction((select v::uuid from t5 where k = 'corr'), true) $$, 'WMS03', null, 'staff cannot decide a correction');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f3","role":"authenticated"}', false);
select lives_ok($$ select public.decide_attendance_correction((select v::uuid from t5 where k = 'corr'), true, 'ok') $$, 'manager approves');
select is((select correction_status::text from public.attendance where id = (select v::uuid from t5 where k = 'corr')), 'APPROVED', 'status is APPROVED and times applied');
select is((select count(*)::int from public.attendance_report('a5000000-0000-0000-0000-000000000001', public.today_ist() - 2, public.today_ist())), 3, 'monthly report lists the attendance rows');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f7","role":"authenticated"}', false);
select throws_ok($$ select * from public.attendance_report('a5000000-0000-0000-0000-000000000001', public.today_ist() - 2, public.today_ist()) $$, 'WMS03', null, 'another warehouse manager cannot export it');

-- E. manager assignment
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f1","role":"authenticated"}', false);
select is((public.remove_manager('a5000000-0000-0000-0000-0000000000f3', 'a5000000-0000-0000-0000-000000000001') ->> 'warning'), 'NO_MANAGER_LEFT', 'removing the last manager warns and does nothing');
select is((select managers from public.warehouse_manager_counts where code = 'H1'), 1, 'manager is still assigned');
select lives_ok($$ select public.assign_manager('a5000000-0000-0000-0000-0000000000f7', 'a5000000-0000-0000-0000-000000000001') $$, 'admin assigns a second manager');
select is((public.remove_manager('a5000000-0000-0000-0000-0000000000f3', 'a5000000-0000-0000-0000-000000000001') ->> 'removed')::boolean, true, 'now removal succeeds');

-- F. crew log, exit, storage rule
select throws_ok($$ select public.set_crew('BOGUS', gen_random_uuid(), '{}') $$, 'WMS57', null, 'unknown document type');
select throws_ok($$ select public.set_crew('INWARD_RECEIPT', gen_random_uuid(), '{}') $$, 'P0002', null, 'unknown document');
select lives_ok($$ select public.exit_employee((select id from public.employees where user_id = 'a5000000-0000-0000-0000-0000000000f6')) $$, 'admin exits an employee');
select is((select is_active from public.profiles where id = 'a5000000-0000-0000-0000-0000000000f6'), false, 'exit deactivates the login');
select is(public.hr_object_allowed('idproof/' || gen_random_uuid() || '/a.pdf'), true, 'admin may use ID proof folder');
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000f7","role":"authenticated"}', false);
select is(public.hr_object_allowed('idproof/' || gen_random_uuid() || '/a.pdf'), false, 'manager may not use ID proof folder');
select is(public.hr_object_allowed('resume/a5000000-0000-0000-0000-000000000001/x/cv.pdf'), true, 'manager may use resumes of their warehouse');
select is(public.hr_object_allowed('resume/a5000000-0000-0000-0000-000000000002/x/cv.pdf'), false, 'but not another warehouse');

select * from finish();
rollback;
