-- =====================================================================
-- Phase 2 enums. Kept in their own migration: a value added to an existing
-- enum (slot_status RESERVED) cannot be used in the transaction that adds it.
-- =====================================================================
alter type public.slot_status add value if not exists 'RESERVED' before 'OCCUPIED';

create type public.client_status    as enum ('ACTIVE', 'ON_HOLD', 'INACTIVE');
create type public.pick_rule        as enum ('FEFO', 'FIFO');
create type public.contract_status  as enum ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');
create type public.company_kind     as enum ('SENDER', 'RECEIVER', 'BOTH');
create type public.booking_status   as enum ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
create type public.gate_direction   as enum ('INWARD', 'OUTWARD');
create type public.gate_status      as enum ('AT_GATE', 'UNLOADING', 'RECEIVED', 'LOADING', 'DISPATCHED', 'CANCELLED');
create type public.line_condition   as enum ('GOOD', 'DAMAGED', 'SHORT');
create type public.stock_condition  as enum ('GOOD', 'DAMAGED');
create type public.document_status  as enum ('CONFIRMED', 'CANCELLED');
create type public.movement_type    as enum ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT');
create type public.labour_activity  as enum ('UNLOADING', 'SORTING', 'STACKING', 'LABELLING', 'LOADING');
create type public.dispatch_status  as enum ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKING', 'DISPATCHED', 'CANCELLED');
