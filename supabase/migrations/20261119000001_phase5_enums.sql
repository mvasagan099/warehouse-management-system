-- Phase 5 enums. Separate migration: a value added to an existing enum cannot be used in the same transaction.
alter type public.applicant_status add value if not exists 'SHORTLISTED' before 'INTERVIEW';

create type public.job_role          as enum ('MANAGER', 'PICKER', 'LOADER', 'SECURITY', 'ACCOUNTANT');
create type public.employee_status   as enum ('ACTIVE', 'ON_LEAVE', 'EXITED');
create type public.correction_status as enum ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
create type public.ticket_status     as enum ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'RESOLVED', 'CLOSED');
create type public.request_status    as enum ('PENDING', 'APPROVED', 'REJECTED');
