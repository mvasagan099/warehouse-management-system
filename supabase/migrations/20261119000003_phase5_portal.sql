-- =====================================================================
-- Phase 5 / 2: client portal (tickets, change requests, alert contacts, notices), opening balances, dashboards.
-- =====================================================================

-- ---------- client alert contacts ----------
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  name text not null check (length(trim(name)) > 0),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  notify_alerts boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (email is not null or phone is not null)
);
create index client_contacts_client_idx on public.client_contacts (client_id) where deleted_at is null;

-- ---------- support tickets ----------
create sequence public.ticket_no_seq;
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default ('T' || lpad(nextval('public.ticket_no_seq')::text, 5, '0')),
  client_id uuid not null references public.clients(id),
  warehouse_id uuid references public.warehouses(id),
  subject text not null check (length(trim(subject)) between 3 and 200),
  status public.ticket_status not null default 'OPEN',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_tickets_client_idx on public.support_tickets (client_id, created_at desc);
create index support_tickets_wh_idx on public.support_tickets (warehouse_id, status);
create table public.ticket_events (                       -- messages and the status trail
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  kind text not null check (kind in ('MESSAGE', 'STATUS')),
  author_id uuid default auth.uid(),
  from_staff boolean not null default false,
  body text, status public.ticket_status, attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

-- ---------- profile / GSTIN change requests ----------
create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  changes jsonb not null,
  status public.request_status not null default 'PENDING',
  requested_by uuid default auth.uid(),
  decided_by uuid, decided_at timestamptz, decision_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index client_change_requests_client_idx on public.client_change_requests (client_id, status);

-- ---------- opening balances (data import; shown in the ledger and ageing, no billing rule changes) ----------
create table public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id),
  as_of date not null,
  amount_paise bigint not null,                -- positive: the client owes us; negative: advance held
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.notifications add column link text;

-- ---------- ticket functions ----------
create or replace function public.open_ticket(p_subject text, p_body text, p_warehouse_id uuid default null, p_attachments text[] default '{}', p_client_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; t uuid;
begin
  if public.is_client() then cid := public.current_client_id();
  elsif public.is_admin() or public.current_app_role() = 'WAREHOUSE_MANAGER' then cid := p_client_id;
  end if;
  if cid is null then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if p_body is null or length(trim(p_body)) < 2 then raise exception 'Describe the problem' using errcode = 'WMS08'; end if;
  insert into public.support_tickets (client_id, warehouse_id, subject) values (cid, p_warehouse_id, trim(p_subject)) returning id into t;
  insert into public.ticket_events (ticket_id, kind, from_staff, body, attachments) values (t, 'MESSAGE', not public.is_client(), trim(p_body), coalesce(p_attachments, '{}'));
  insert into public.ticket_events (ticket_id, kind, from_staff, status) values (t, 'STATUS', not public.is_client(), 'OPEN');
  return t;
end $$;

create or replace function public.reply_ticket(p_ticket_id uuid, p_body text, p_attachments text[] default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; staff boolean;
begin
  select * into t from public.support_tickets where id = p_ticket_id;
  if t.id is null then raise exception 'Ticket not found' using errcode = 'P0002'; end if;
  staff := not public.is_client();
  if public.is_client() then if t.client_id is distinct from public.current_client_id() then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  elsif not (public.is_admin() or (t.warehouse_id is not null and public.manages_warehouse(t.warehouse_id))) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  if t.status = 'CLOSED' then raise exception 'Ticket is closed' using errcode = 'WMS58'; end if;
  if p_body is null or length(trim(p_body)) < 1 then raise exception 'Write a message' using errcode = 'WMS08'; end if;
  insert into public.ticket_events (ticket_id, kind, from_staff, body, attachments) values (t.id, 'MESSAGE', staff, trim(p_body), coalesce(p_attachments, '{}'));
  if staff and t.status = 'OPEN' then
    update public.support_tickets set status = 'IN_PROGRESS', updated_at = now() where id = t.id;
    insert into public.ticket_events (ticket_id, kind, from_staff, status) values (t.id, 'STATUS', true, 'IN_PROGRESS');
  elsif not staff and t.status in ('WAITING_CLIENT', 'RESOLVED') then
    update public.support_tickets set status = 'OPEN', updated_at = now() where id = t.id;
    insert into public.ticket_events (ticket_id, kind, from_staff, status) values (t.id, 'STATUS', false, 'OPEN');
  else update public.support_tickets set updated_at = now() where id = t.id; end if;
  if staff then
    perform public.notify_client(t.client_id, 'TICKET', format('Reply on ticket %s', t.ticket_no), left(trim(p_body), 300), '/support', false);
  end if;
end $$;

create or replace function public.set_ticket_status(p_ticket_id uuid, p_status public.ticket_status, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets;
begin
  select * into t from public.support_tickets where id = p_ticket_id;
  if t.id is null then raise exception 'Ticket not found' using errcode = 'P0002'; end if;
  if public.is_client() then
    if t.client_id is distinct from public.current_client_id() or p_status not in ('CLOSED') then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  elsif not (public.is_admin() or (t.warehouse_id is not null and public.manages_warehouse(t.warehouse_id))) then raise exception 'Not allowed' using errcode = 'WMS03'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = t.id;
  insert into public.ticket_events (ticket_id, kind, from_staff, status, body) values (t.id, 'STATUS', not public.is_client(), p_status, p_note);
  if not public.is_client() then
    perform public.notify_client(t.client_id, 'TICKET', format('Ticket %s is now %s', t.ticket_no, replace(lower(p_status::text), '_', ' ')), p_note, '/support', false);
  end if;
end $$;

-- ---------- change requests ----------
create or replace function public.request_client_change(p_changes jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid := public.current_client_id(); k text; r uuid;
begin
  if not public.is_client() or cid is null then raise exception 'Only a client login can request changes' using errcode = 'WMS03'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}' then raise exception 'Nothing to change' using errcode = 'WMS08'; end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('gstin', 'pan', 'company_name', 'address_line1', 'address_line2', 'city', 'district', 'state', 'state_code', 'pincode', 'contact_name', 'phone', 'email') then
      raise exception 'Field % cannot be changed here', k using errcode = 'WMS08'; end if;
  end loop;
  if p_changes ? 'gstin' and p_changes ->> 'gstin' <> '' and not public.is_valid_gstin(p_changes ->> 'gstin') then raise exception 'GSTIN is not valid' using errcode = 'WMS08'; end if;
  update public.client_change_requests set status = 'REJECTED', decision_note = 'Replaced by a newer request', decided_at = now() where client_id = cid and status = 'PENDING';
  insert into public.client_change_requests (client_id, changes) values (cid, p_changes) returning id into r;
  return r;
end $$;

create or replace function public.decide_client_change(p_request_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.client_change_requests; c jsonb;
begin
  if not public.is_admin() then raise exception 'Only an administrator approves profile changes' using errcode = 'WMS03'; end if;
  select * into r from public.client_change_requests where id = p_request_id for update;
  if r.id is null or r.status <> 'PENDING' then raise exception 'No pending request' using errcode = 'WMS55'; end if;
  if p_approve then
    c := r.changes;
    update public.clients set
      gstin = case when c ? 'gstin' then nullif(c ->> 'gstin', '') else gstin end,
      pan = case when c ? 'pan' then nullif(c ->> 'pan', '') else pan end,
      company_name = coalesce(nullif(c ->> 'company_name', ''), company_name),
      address_line1 = case when c ? 'address_line1' then c ->> 'address_line1' else address_line1 end,
      address_line2 = case when c ? 'address_line2' then c ->> 'address_line2' else address_line2 end,
      city = case when c ? 'city' then c ->> 'city' else city end,
      district = case when c ? 'district' then c ->> 'district' else district end,
      state = case when c ? 'state' then c ->> 'state' else state end,
      state_code = case when c ? 'state_code' then nullif(c ->> 'state_code', '') else state_code end,
      pincode = case when c ? 'pincode' then nullif(c ->> 'pincode', '') else pincode end,
      contact_name = case when c ? 'contact_name' then c ->> 'contact_name' else contact_name end,
      phone = case when c ? 'phone' then c ->> 'phone' else phone end,
      email = case when c ? 'email' then c ->> 'email' else email end
    where id = r.client_id;
  end if;
  update public.client_change_requests set status = case when p_approve then 'APPROVED' else 'REJECTED' end::public.request_status,
    decided_by = auth.uid(), decided_at = now(), decision_note = p_note, updated_at = now() where id = r.id;
  perform public.notify_client(r.client_id, 'PROFILE', case when p_approve then 'Profile change approved' else 'Profile change not approved' end, p_note, '/profile', false);
end $$;

-- ---------- notices to clients (in-app + email, switchable per kind in settings) ----------
insert into public.app_settings (key, value, description) values
  ('client_notices', '{"STOCK_RECEIVED": true, "DISPATCHED": true, "INVOICE": true, "PAYMENT": true, "OVERDUE": true, "TICKET": true, "PROFILE": true}', 'Which events send the client an in-app notice and an email')
on conflict (key) do nothing;

create or replace function public.notify_client(p_client_id uuid, p_kind text, p_title text, p_body text, p_link text default null, p_email boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare cfg jsonb := coalesce((select value from public.app_settings where key = 'client_notices'), '{}'::jsonb); u record; c public.clients;
begin
  if coalesce((cfg ->> p_kind)::boolean, true) is not true then return; end if;
  select * into c from public.clients where id = p_client_id;
  for u in select id from public.profiles where role = 'CLIENT' and client_id = p_client_id and is_active and deleted_at is null loop
    insert into public.notifications (user_id, kind, title, body, link) values (u.id, p_kind, p_title, p_body, p_link);
  end loop;
  if p_email and c.email is not null and coalesce((select (value ->> 'email')::boolean from public.app_settings where key = 'notifications'), true) then
    insert into public.notification_outbox (channel, to_address, subject, body) values ('EMAIL', c.email, p_title, coalesce(p_body, p_title));
  end if;
end $$;

create or replace function public.client_event_notice() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- one branch per table: plpgsql plans each IF separately, so a column of another table's type is never compared
  if tg_table_name = 'inward_receipts' then
    if new.status = 'CONFIRMED' then
      perform public.notify_client(new.client_id, 'STOCK_RECEIVED', format('Stock received: %s', new.receipt_no), 'Your goods were received and stored. Open Receipts for the details.', '/receipts');
    end if;
  elsif tg_table_name = 'delivery_challans' then
    if new.status = 'CONFIRMED' then
      perform public.notify_client(new.client_id, 'DISPATCHED', format('Dispatch completed: %s', new.challan_no), 'Your goods left the warehouse. Open Challans for the details.', '/challans');
    end if;
  elsif tg_table_name = 'invoices' then
    if new.status = 'ISSUED' and (tg_op = 'INSERT' or old.status is distinct from 'ISSUED') then
      perform public.notify_client(new.client_id, 'INVOICE', format('Invoice issued: %s', new.invoice_no), format('Invoice %s for %s to %s is ready.', new.invoice_no, new.period_from, new.period_to), '/invoices');
    end if;
  elsif tg_table_name = 'payments' then
    if new.status = 'RECORDED' then
      perform public.notify_client(new.client_id, 'PAYMENT', format('Payment received: %s', new.payment_no), 'Thank you. Your payment was recorded.', '/payments');
    end if;
  elsif tg_table_name = 'reminder_queue' then
    perform public.notify_client(new.client_id, 'OVERDUE', 'Payment overdue', format('An invoice is %s days past its due date.', new.days_after_due), '/invoices', false);
  end if;
  return null;
end $$;
create trigger client_notice after insert on public.inward_receipts for each row execute function public.client_event_notice();
create trigger client_notice after insert on public.delivery_challans for each row execute function public.client_event_notice();
create trigger client_notice after insert or update on public.invoices for each row execute function public.client_event_notice();
create trigger client_notice after insert on public.payments for each row execute function public.client_event_notice();
create trigger client_notice after insert on public.reminder_queue for each row execute function public.client_event_notice();

-- temperature notices also reach the client's alert contacts (still only after manager approval)
create or replace function public.approve_client_notice(p_notice_id uuid, p_subject text default null, p_body text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare n public.client_notices; c public.clients; r record;
begin
  select * into n from public.client_notices where id = p_notice_id for update;
  if not found then raise exception 'Notice not found' using errcode = 'P0002'; end if;
  if not public.can_write_warehouse(n.warehouse_id) then raise exception 'Only an administrator or the warehouse manager can approve client notices' using errcode = '42501'; end if;
  if n.status <> 'DRAFT' then raise exception 'Notice is already %', n.status using errcode = 'WMS03'; end if;
  update public.client_notices set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(),
         subject = coalesce(nullif(trim(p_subject), ''), subject), body = coalesce(nullif(trim(p_body), ''), body) where id = n.id returning * into n;
  select * into c from public.clients where id = n.client_id;
  perform public.queue_message(null, c.email, c.phone, 'CLIENT_NOTICE', n.subject, n.body, n.alert_id);
  for r in select email, phone from public.client_contacts where client_id = n.client_id and notify_alerts and deleted_at is null loop
    perform public.queue_message(null, r.email, r.phone, 'CLIENT_NOTICE', n.subject, n.body, n.alert_id);
  end loop;
  for r in select id from public.profiles where role = 'CLIENT' and client_id = n.client_id and is_active and deleted_at is null loop
    perform public.queue_message(r.id, null, null, 'CLIENT_NOTICE', n.subject, n.body, n.alert_id);
  end loop;
end $$;

-- ---------- opening balance in the ledger and ageing ----------
create or replace function public.client_ledger(p_client_id uuid, p_from date default null, p_to date default null)
returns table (entry_date date, doc_type text, doc_no text, description text, debit_paise bigint, credit_paise bigint, balance_paise bigint, doc_id uuid)
language sql stable set search_path = ''
as $$
  with e as (
    select i.invoice_date d, i.issued_at ts, 'INVOICE'::text t, i.invoice_no n, format('Invoice %s to %s', i.period_from, i.period_to) ds, i.grand_total_paise db, 0::bigint cr, i.id
      from public.invoices i where i.client_id = p_client_id and i.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')
    union all select n.note_date, n.created_at, case n.kind when 'DEBIT' then 'DEBIT_NOTE' else 'CREDIT_NOTE' end, n.note_no, n.reason,
        case when n.kind = 'DEBIT' then n.grand_total_paise else 0 end, case when n.kind = 'CREDIT' then n.grand_total_paise else 0 end, n.id
      from public.adjustment_notes n where n.client_id = p_client_id
    union all select p.paid_on, p.created_at, 'PAYMENT', p.payment_no, concat_ws(' ', p.method::text, p.reference), 0, p.amount_paise, p.id
      from public.payments p where p.client_id = p_client_id
    union all select p.reversed_at::date, p.reversed_at, 'PAYMENT_REVERSAL', p.payment_no, p.reversed_reason, p.amount_paise, 0, p.id
      from public.payments p where p.client_id = p_client_id and p.status = 'REVERSED'
    union all select b.as_of, b.created_at, 'OPENING_BALANCE', 'OPENING', coalesce(b.notes, 'Opening balance'), greatest(b.amount_paise, 0), greatest(-b.amount_paise, 0), b.id
      from public.opening_balances b where b.client_id = p_client_id
  ), o as (select e.*, sum(e.db - e.cr) over (order by e.d, e.ts, e.id) bal from e)
  select o.d, o.t, o.n, o.ds, o.db, o.cr, o.bal::bigint, o.id from o
  where (p_from is null or o.d >= p_from) and (p_to is null or o.d <= p_to) order by o.d, o.ts, o.id
$$;

-- ---------- RLS ----------
alter table public.client_contacts enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.client_change_requests enable row level security;
alter table public.opening_balances enable row level security;

create policy contacts_select on public.client_contacts for select to authenticated using (public.can_see_client(client_id));
create policy contacts_insert on public.client_contacts for insert to authenticated with check (public.is_my_client(client_id) or public.is_admin());
create policy contacts_update on public.client_contacts for update to authenticated using (public.is_my_client(client_id) or public.is_admin()) with check (public.is_my_client(client_id) or public.is_admin());
create policy tickets_select on public.support_tickets for select to authenticated
  using (public.is_my_client(client_id) or public.is_admin() or (warehouse_id is not null and public.manages_warehouse(warehouse_id)));
create policy ticket_events_select on public.ticket_events for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (public.is_my_client(t.client_id) or public.is_admin() or (t.warehouse_id is not null and public.manages_warehouse(t.warehouse_id)))));
create policy change_requests_select on public.client_change_requests for select to authenticated using (public.is_my_client(client_id) or public.is_admin());
create policy opening_balances_select on public.opening_balances for select to authenticated using (public.is_admin() or public.is_accountant() or public.is_my_client(client_id));

revoke all on public.client_contacts, public.support_tickets, public.ticket_events, public.client_change_requests, public.opening_balances from anon;
revoke insert, update, delete on public.support_tickets, public.ticket_events, public.client_change_requests, public.opening_balances from authenticated;
revoke delete on public.client_contacts from authenticated;
revoke execute on all functions in schema public from anon, public;
revoke execute on function public.notify_client(uuid, text, text, text, text, boolean), public.client_event_notice() from authenticated;
do $$ declare t text; begin
  foreach t in array array['client_contacts', 'support_tickets', 'client_change_requests', 'opening_balances'] loop
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
-- audit_row_change reads warehouse_id: support_tickets has it, the others log without one.

-- ---------- ticket attachments bucket: <client_id>/<ticket>/<file> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) on conflict (id) do nothing;
create policy wms_tickets_insert on storage.objects for insert to authenticated with check (bucket_id = 'tickets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (public.is_my_client(((storage.foldername(name))[1])::uuid) or public.is_admin() or public.current_app_role() = 'WAREHOUSE_MANAGER'));
create policy wms_tickets_select on storage.objects for select to authenticated using (bucket_id = 'tickets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (public.is_my_client(((storage.foldername(name))[1])::uuid) or public.is_admin() or public.current_app_role() = 'WAREHOUSE_MANAGER'));
