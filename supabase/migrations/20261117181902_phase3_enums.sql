-- Phase 3 enums. Values added to existing enums cannot be used in the same transaction, so they live here.
alter type public.app_role       add value if not exists 'ACCOUNTANT';
alter type public.labour_activity add value if not exists 'PICKING';
alter type public.labour_activity add value if not exists 'PACKING';

create type public.rate_scope      as enum ('CLIENT', 'GROUP', 'WAREHOUSE', 'GLOBAL');
create type public.rent_basis      as enum ('PER_BRIGADE', 'PER_M3');
create type public.labour_basis    as enum ('PER_PACKAGE', 'PER_TONNE', 'PER_BRIGADE_MOVED', 'PER_HOUR', 'FLAT_PER_LORRY');
create type public.premium_type    as enum ('NONE', 'PERCENT', 'AMOUNT');
create type public.billing_cycle   as enum ('WEEKLY', 'MONTHLY', 'ON_DEMAND');
create type public.billing_mode    as enum ('RENT_ONLY', 'LABOUR_ONLY', 'BOTH');
create type public.invoice_status  as enum ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
create type public.invoice_section as enum ('RENT', 'LABOUR', 'OTHER');
create type public.note_kind       as enum ('CREDIT', 'DEBIT');
create type public.payment_method  as enum ('UPI', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'ONLINE', 'DEPOSIT_ADJUSTMENT');
create type public.charge_calc     as enum ('FIXED', 'PERCENT');
