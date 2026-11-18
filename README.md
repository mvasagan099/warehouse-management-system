# Cold Storage WMS — Phases 1 to 4

Warehouse & cold-storage management for a Tamil Nadu business.

- **Phase 1 (foundation):** auth and roles, warehouses, zones, brigade types and slots, managers and staff, hiring, audit log, dashboard.
- **Phase 2 (operations):** clients and contracts, space booking, gate / lorry entry, inward receipt, stock, QR labels and scanning, dispatch, delivery challan, client portal.
- **Phase 3 (billing):** rate cards with scope precedence, daily occupancy snapshots, rent and labour invoices with India GST, credit and debit notes, payments, client ledger and ageing, PDF / email / Razorpay link, GSTR-1 and Tally exports, ACCOUNTANT role. See *Phase 3: billing* below.
- **Phase 4 (cold chain):** sensors with per-device keys, HTTPS ingest, manual readings, live zone dashboard (Realtime), alert engine with escalation, affected-stock lookup, client notices, calibration, client temperature reports, evidence packs, equipment and maintenance. See [docs/cold-chain.md](docs/cold-chain.md).
- **Not built (by design):** MQTT broker, WhatsApp / SMS providers (stub only), mobile push, predictive maintenance, energy cost tracking, calling the government e-invoice portal, Tamil invoice printing.
**No custom backend:** a React SPA talks directly to Supabase (Postgres + Auth + Storage). All
authorisation lives in Postgres Row Level Security; the only privileged code is one Edge Function
(`create-user`) that holds the service key server-side.

## Stack

React 19 + Vite + TypeScript · Tailwind CSS v4 · React Router · TanStack Query & Table ·
React Hook Form + Zod · i18next (English / தமிழ்) · Recharts · Supabase (Postgres 17, Auth, Edge Functions) ·
Vitest + Testing Library · pgTAP.

## Prerequisites

- Node 20+ and npm
- Docker Desktop (running) — needed by the local Supabase stack
- The Supabase CLI is a dev dependency; use it via `npx supabase …` (no global install needed)

## Run locally

```bash
npm install
npx supabase start            # first run pulls Docker images (a few minutes)
npx supabase db reset         # applies migrations + seed (one SUPER_ADMIN)
npx supabase status           # copy "API URL" and "anon key"
cp .env.example .env.local    # paste them into VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npx supabase functions serve  # in a second terminal: serves the create-user Edge Function
npm run dev                   # http://localhost:5173
```

Local seeded login (local only, created by `supabase/seed.sql`):

| Email | Password | Role |
|---|---|---|
| `admin@warehouse.local` | `Admin@12345` | SUPER_ADMIN |

Users you create from **Managers & Staff** get a temporary password and must change it at first login.
Local password-reset emails are caught by Mailpit at http://127.0.0.1:54324.

### The Phase 1 acceptance walkthrough

1. Log in as admin → **Warehouses → Add warehouse** (leave Code blank → `W1`).
2. **Zones → Add zone**: a *Dry* zone, then a *Frozen* zone with min −25 / max −18 °C.
3. **Slot Builder** → pick the frozen zone → 10 aisles × 5 racks × 2 levels × 1 slot → **Create slots** (100 slots, `W1-Z2-A1-R1-L1-B01` … `W1-Z2-A10-R5-L2-B01`).
4. **Managers & Staff → Add user** → role *Warehouse Manager*, tick W1, note the temporary password.
5. Log out, log in as the manager, set a new password → the dashboard shows only W1.

## Tests

```bash
npm test                  # Vitest (156): schemas, GSTIN, roles, receipt / pick / stock logic, amount in words, CSV, Razorpay signature, i18n key coverage, route guards, create-user rules
npm run test:db           # pgTAP (427): RLS per role, confirm functions, FEFO, rollback, numbering, cancellation, plus Phase 3: rates, occupancy, rent / labour / GST maths, immutability, notes, payments (needs `supabase start`)
npm run test:concurrency  # 30 parallel sessions for document numbers, 20 parallel issue_invoice calls: never skip or duplicate
npm run test:e2e          # Playwright: Phase 2 (client -> booking -> gate -> receipt -> dispatch -> challan -> portal) and Phase 3 (rates -> stock -> advance days -> invoice -> issue -> payment -> client PDF -> accountant) and Phase 4 (sensor -> curl readings -> live tile -> excursion -> alert -> acknowledge -> resolve -> client temperature report and evidence pack)
npm run test:all          # all of the above
npm run typecheck && npm run build
```

`test:e2e` runs against the **local** stack only (it refuses any other URL): start `npx supabase start`, `npx supabase functions serve`
in a second terminal, then `npx supabase db reset` for a clean database. The browser is installed once with `npx playwright install chromium`.

The RLS suite proves: a manager cannot read or edit another warehouse (or move a zone into one, build slots
there, assign themselves, or escalate their role); staff cannot write; a client sees nothing; anonymous
users are refused outright; the audit trigger records who changed what.

## Phase 2 tables

| Area | Tables |
|---|---|
| Masters | `clients` (GSTIN checked mod-36, state and PAN derived), `contracts` (nullable `rate_card_id` for Phase 3), `company_master` (sender / receiver per client), `gst_states`, `app_settings`, `doc_types`, `doc_counters` |
| Booking | `space_bookings` (+ `brigade_slots.reserved_client_id / booking_id`, slot status `RESERVED`) |
| Gate | `gate_entries` (inward and outward), `gate_entry_lines`, private storage buckets `gate-photos` and `signatures` |
| Inward and stock | `inward_receipts`, `inward_receipt_lines`, `stock_items`, `stock_movements` (append-only ledger), `slot_allocations` (start / end dates for billing), `labour_entries` (facts only) |
| Dispatch | `dispatch_requests`, `dispatch_request_lines`, `dispatch_picks`, `delivery_challans`, `delivery_challan_lines` |

All writes to stock go through `SECURITY DEFINER` functions (`confirm_inward_receipt`, `confirm_delivery_challan`, `transfer_stock`,
`adjust_stock`, `cancel_*`), each one transaction. Error codes: `WMS01` temperature mismatch, `WMS02` over capacity, `WMS03` wrong state,
`WMS04` insufficient stock, `WMS05` not enough slots, `WMS06` counts do not add up, `WMS07` slot not usable, `WMS08` reason required,
`WMS09` cannot reverse, `WMS10` number too long, `WMS11` wrong batch scanned, `WMS12` ambiguous slot scan, `WMS13` picking incomplete,
`WMS14` no active contract.

Document numbers: `<prefix>/<warehouse>/<financial year>/<serial>`, e.g. `GR/W1/2627/0001`, `DC/W1/2627/0001`. At most 16 characters, so
warehouse codes of up to 3 characters (W1 to W99) work with the 2-letter prefixes in `doc_types`. A rolled-back document never uses up a number.

QR labels carry `WMS:SLOT:<id>` and `WMS:STOCK:<id>`; picking also accepts the batch number.

## Project layout

```
supabase/
  config.toml                      local stack config (public sign-up disabled)
  migrations/
    …122332_core_schema.sql            enums, tables, indexes, updated_at + denormalisation triggers, auth→profile sync
    …122403_rls.sql                    helper functions (is_admin, manages_warehouse, …), RLS policies, grants, profile guard
    …122427_audit_slots_dashboard.sql  generic audit trigger, create_brigade_slots(), v_zone_slot_summary view
    …122431_reference_data.sql         default "Standard Brigade" 1.2 m cube (all environments)
    …122704_lock_trigger_functions.sql trigger functions not callable through the API
  seed.sql                         LOCAL ONLY: one super admin
  functions/create-user/           Edge Function (index.ts) + pure, unit-tested rules (rules.ts)
  tests/database/rls.test.sql      pgTAP tests
src/
  auth/            AuthProvider (session + profile + warehouse scope), route guards, role map, auth schemas
  components/      layout (sidebar, header, language switch) and UI kit (DataTable, Modal, Field, …)
  features/        dashboard, warehouses, zones, brigade-types, slots, users, hiring, audit,
                   clients, bookings, gate, inward, stock, dispatch, challans, labels, scan, portal, pdf, shared queries
  i18n/            i18next setup + locales/en.json, locales/ta.json
  lib/             supabase client, generated-type helpers, IST formatting, paise money helpers, zod helpers
  pages/           login, forgot/reset/change password, message pages
  types/database.ts  generated by `npm run db:types`
```

## Security model

| Role | Access |
|---|---|
| SUPER_ADMIN | Everything |
| WAREHOUSE_MANAGER | Read/write zones, slots, staff, hiring for warehouses listed in `warehouse_managers`; read their warehouses and brigade types |
| STAFF | Read-only: their warehouse (`profiles.warehouse_id`), its zones and slots, brigade types |
| CLIENT | Own profile row only (no Phase 1 data) |
| anon | No table grants at all |

- RLS is enabled on every table; a pgTAP test fails if any `public` table lacks it.
- Policies call `SECURITY DEFINER` helpers: `current_app_role()`, `is_admin()`, `manages_warehouse(id)`,
  `is_staff_of(id)`, `can_read_warehouse(id)`, `can_write_warehouse(id)`.
- `profiles_guard` trigger stops non-admins changing role, email, warehouse or (re)activating accounts.
- Roles are only ever taken from `auth.users.raw_app_meta_data` (settable only with the service key).
- `brigade_slots.warehouse_id` and `applicants.warehouse_id` are copied from their parent by trigger, so
  they cannot be spoofed to slip past RLS.
- The browser only has the anon/publishable key. `create-user` checks the caller's JWT + role
  (admin → managers/staff; manager → staff for their own warehouses only) before using the service key.
- Public sign-up is disabled; accounts are created by admins/managers.

## Environments

| | Local | Hosted (production) |
|---|---|---|
| Supabase | `npx supabase start` (Docker) | project ref `zzbpramdnuguymeaovma`, region ap-northeast-2 |
| API URL | `http://127.0.0.1:54321` | `https://zzbpramdnuguymeaovma.supabase.co` |
| Frontend key | anon key from `npx supabase status` | publishable key (Dashboard → Project Settings → API Keys) |
| Migrations | applied by `supabase db reset` | 23 migrations applied (5 for Phase 1, 7 for Phase 2, 7 for Phase 3, 4 for Phase 4); versions match the files in `supabase/migrations` |
| Edge Functions | `npx supabase functions serve` | `create-user`, `send-invoice`, `razorpay-link` (verify JWT on), `razorpay-webhook` (JWT off: HMAC signature) `send-reminders` (JWT off: checks an administrator JWT or the `x-cron-secret` header itself), `ingest-reading` (JWT off: the device key is the credential) and `notify-alert` (JWT off: `x-cron-secret` or an administrator JWT) |

Git: `origin` pushes to two repositories at once —
`warehousemanagementadmin099-web/warehouse` and `mvasagan099/warehouse-management-system` — each
over its own SSH deploy key (`github-wms-1` / `github-wms-2` aliases in `~/.ssh/config`).

## Deploy

**Supabase (hosted)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                                  # migrations only — never run seed.sql in production
npx supabase functions deploy create-user
npx supabase secrets set ALLOWED_ORIGIN=https://<your-app>.pages.dev
```

Then in the dashboard: Authentication → disable "Allow new users to sign up", set Site URL and the redirect
URL `https://<your-app>.pages.dev/reset-password`, configure SMTP for reset emails. Create the first super
admin with Authentication → Add user, then run in the SQL editor:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"SUPER_ADMIN"}' where email = 'you@company.in';
```

**Cloudflare Pages:** build command `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (the hosted project's anon/publishable key). `public/_redirects` handles SPA routes.

## Conventions

- Money is integer **paise** (`bigint` columns ending in `_paise`), helpers in `src/lib/money.ts`. No floats.
- Timestamps are `timestamptz` (UTC) and displayed in `Asia/Kolkata` (`src/lib/format.ts`).
- Sizes, temperatures, rates live in tables, not code (brigade dimensions, zone temperature bands, expiry alert days in `app_settings`).
- Soft delete (`deleted_at`) everywhere; queries filter `deleted_at is null`. `audit_logs` is append-only.
- After a schema change: add a migration, `npx supabase db reset`, `npm run db:types`.

## Phase 3: billing

All money is integer **paise**. Every calculation happens in Postgres functions in one transaction; the browser only shows results.
Nothing (rate, tax rate, SAC code, rule) is hard-coded: they live in tables and `app_settings`.

**Tables (new):** `client_groups`, `rate_cards`, `rent_rates`, `labour_rates`, `other_charges`, `tax_rules`, `daily_occupancy`, `occupancy_runs`,
`invoices`, `invoice_lines`, `invoice_tax_lines`, `adjustment_notes`, `adjustment_note_lines`, `payments`, `payment_allocations`, `reminder_queue`,
`billing_job_log`; new columns on `clients` (group, billing cycle / mode, payment terms, GST exemption, credit override), `labour_entries`
(`is_night`, `is_overtime`), `inward_receipts` / `delivery_challans` (`billed_invoice_id`), `slot_allocations` (`min_days_invoice_id`).
New enum values: role `ACCOUNTANT`, labour activities `PICKING`, `PACKING`. Private storage bucket `invoices`.

**Functions:** `resolve_rent_rate` / `resolve_labour_rate` (the only two rate resolvers; `rent_rate_candidates` / `labour_rate_candidates` power the
rate tester), `resolve_rate_terms`, `resolve_tax_rule`, `my_rate_summary`, `snapshot_occupancy(date)`, `snapshot_occupancy_backfill`,
`generate_invoice_draft`, `fix_invoice_line`, `remove_invoice_line`, `add_other_charge`, `discard_draft_invoice`, `issue_invoice`, `einvoice_json`,
`issue_adjustment_note`, `record_payment`, `reverse_payment`, `client_ledger`, `ageing_report`, `mark_overdue_invoices`, `billing_block_reason`,
`set_billing_override`, `generate_scheduled_drafts`, `report_revenue`, `report_utilisation`, `gstr1_register`, `tally_export_xml`.
Error codes: `WMS20` nothing to bill, `WMS21` rate already used, `WMS22` day not finished, `WMS23` no rate / tax rule, `WMS24` credit block,
`WMS25` invoice immutable, `WMS26` period already billed, `WMS27` deposit too small, `WMS28` credit note too large, `WMS29` billed document.

**Scheduled jobs (pg_cron, always UTC; India time = UTC + 5:30):**

| Job | UTC | India time | What |
|---|---|---|---|
| `wms-occupancy-snapshot` | `35 18 * * *` | 00:05 | `snapshot_occupancy_backfill()`: yesterday's occupancy (idempotent; also fills any missed day) |
| `wms-mark-overdue` | `0 19 * * *` | 00:30 | `mark_overdue_invoices()`: status OVERDUE and queues reminder emails |
| `wms-generate-invoices` | `10 19 * * *` | 00:40 | `generate_scheduled_drafts()`: DRAFT invoices for WEEKLY (Monday) / MONTHLY (1st) clients |

**Edge Functions and secrets** (set with `npx supabase secrets set NAME=value`, never in the browser):

| Function | Needs | Notes |
|---|---|---|
| `send-invoice` | `RESEND_API_KEY` (and a From address in Billing settings or `RESEND_FROM`) | emails the PDF the browser uploaded to the `invoices` bucket; behind the `email` setting flag |
| `razorpay-link` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | creates a payment link for what is outstanding; behind the `razorpay` flag |
| `razorpay-webhook` | `RAZORPAY_WEBHOOK_SECRET` | verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body), records the payment idempotently by Razorpay payment id |
| `send-reminders` | `RESEND_API_KEY`, optional `CRON_SECRET` | sends the queued overdue reminders (admin button, or a scheduler calling it with `x-cron-secret`) |

The Razorpay webhook URL is `https://<project>.supabase.co/functions/v1/razorpay-webhook` (event `payment_link.paid`).
The Resend and Razorpay calls themselves could not be exercised without real keys: the request and signature logic is unit tested.

**Roles in billing:** SUPER_ADMIN sets rates, generates, fixes, issues, records payments. ACCOUNTANT reads and exports everything (read only).
WAREHOUSE_MANAGER sees issued billing data of their own warehouses (read only). STAFF see nothing. A CLIENT sees its own issued invoices, payments,
ledger and rate summary and downloads PDFs. Every create / update / issue / cancel is in the audit log.

### Assumptions to confirm (especially with your accountant)

1. **SAC codes and GST rates are suggested defaults, not advice:** 996721 refrigerated storage, 996729 other storage / warehousing,
   996719 other cargo handling, all 18 %. Edit them in *Rate Cards -> SAC & GST*. Rent is taxed per storage type (frozen / chilled = 996721, others 996729).
2. Supplier state is `33` (Tamil Nadu) in the `supplier` setting. Client GSTIN state 33 -> CGST + SGST (half each); another state -> IGST;
   no GSTIN -> consumer taxed by the supplier-state rule. Fill the supplier GSTIN, address and bank details in *Billing Settings* before the first invoice.
3. Tax is computed per section on the taxable value after discount; each tax amount is rounded half-up to the paisa; a visible round-off line makes the grand total a whole rupee.
4. Day counting is a setting: the start day counts, the end day does not, and a Brigade held for part of a day counts that day.
5. Volume tiers pick the rate by the total Brigades held that day and apply it to all of them (whole-volume tiers, not slab tiers).
6. Free days are counted per allocation (each Brigade's first N days). Minimum billing days are a top-up line added when a stay ends short.
7. The cold-room premium is applied in proportion to the cold packages in the document; night and overtime multipliers apply to the activity's amount.
8. Invoice numbers are `IN/<warehouse>/<financial year>/<serial>` (e.g. `IN/W1/2627/0001`, at most 16 characters); credit notes `CN`, debit notes `DN`, payments `PY`.
9. Payments settle the oldest invoice (or debit note) first; the rest stays as an advance, applied automatically to the next invoice.
10. Ageing is by days since the invoice date (0-30, 31-60, 61-90, 90+).
11. The e-invoice JSON follows the IRP 1.1 shape for upload; the government portal is not called (IRN and QR fields are stored empty).
12. A day already on an invoice is never recomputed; correct an invoice only with a credit or debit note.

## Phase 4: cold-chain monitoring

Full guide, curl and ESP32 samples: [docs/cold-chain.md](docs/cold-chain.md).

**Tables (new):** `sensors`, `device_keys` (hash only), `calibration_log`, `readings` (partitioned by month) and `readings_hourly`, `alert_rules`,
`defrost_windows`, `alerts`, `alert_evidence`, `alert_stock`, `client_notices`, `notifications`, `notification_outbox`, `equipment`,
`maintenance_tasks`, `internal_secrets`. New settings keys `coldchain` and `notifications`. Private storage bucket `coldchain`.

**Functions:** `ingest_readings` (service role only), `create_device_key`, `rotate_device_key`, `revoke_device_key`, `record_calibration`,
`add_manual_reading`, `evaluate_alerts`, `acknowledge_alert`, `resolve_alert`, `affected_stock`, `approve_client_notice`, `reject_client_notice`,
`rollup_readings`, `ensure_reading_partitions`, `cold_chain_overview`, `zone_series`, `client_temperature_report`, `client_lorry_temps`,
`complete_maintenance_task`, `update_maintenance_task`, `maintenance_reminders`, `dispatch_notifications`, `mark_notifications_read`.
Error codes: `WMS40` bad device key, `WMS41` bad batch, `WMS43` impossible manual value.

**Cron (UTC):** `wms-evaluate-alerts` and `wms-notify-dispatch` every minute, `wms-readings-rollup` `30 20 * * *` (02:00 India), `wms-maintenance-reminders` `30 2 * * *` (08:00 India).

**Edge Functions:** `ingest-reading` (sensors post here), `notify-alert` (sends the queued email; WhatsApp / SMS are a stub). Secrets: `RESEND_API_KEY`, `CRON_SECRET`.

**Access:** administrator everything; manager and staff their warehouses; staff add manual readings, acknowledge alerts and update tasks but cannot
change rules, sensors, keys or calibration, resolve alerts or approve client notices; a client sees only the temperature reports and the readings and
alerts for the days its stock was in a zone; accountants have no access. Every change to rules, keys, calibration and alerts is in the audit log.

### Assumptions to confirm

1. Alert levels: out of range = beyond the zone limit plus the tolerance; WARNING after the delay (10 min); CRITICAL when more than 5 C beyond the limit or after 30 minutes. All are editable per zone.
2. An alert closes by itself after the readings stay in range for the recovery time (5 min) but stays on the list until a person resolves it.
3. Escalation: staff first, then the managers, then administrators, every 15 minutes while a CRITICAL alert is unacknowledged. If nobody exists at a level the next level is told at once.
4. A sensor is offline after 15 minutes of silence; a manual-only zone counts as stale after 12 hours.
5. A client's right to see readings follows the India calendar days of its allocations in the zone (start day to end day inclusive), not the exact hour.
6. Affected stock = allocations overlapping the event days plus stock items in those slots that had arrived and not left before the event (a batch moved to another zone before the event is not listed).
7. Client temperature reports measure "out of range" against the zone limits with no tolerance; time is the span between readings, and gaps over 15 minutes are not counted as covered.
8. The manual reading sensor of a zone is created automatically; manual readings are not corrected by calibration.
9. Raw readings are kept 30 days, hourly summaries 2 years (settings). About 150 bytes per reading: 6.5 MB per sensor-month at one reading per minute.

## Notes

- PDFs (receipt, challan) are printed in English: the built-in PDF font has no Tamil glyphs. Embed a Tamil font in `src/features/pdf/documents.tsx` to print Tamil.
- A client login can be created only by an administrator (Clients -> Create login); the temporary password must be changed at first sign-in.

## Phase 5 (hiring, portal, hardening)
- **Hiring and staff:** vacancies (salary range admin-only), applicants with private resume, interview rounds, offer-letter PDF, login + employee record in one step, staff list with admin-only ID/bank details, shifts/roster, phone check-in/out (optional GPS), manager corrections, monthly CSV, manager assignment with last-manager warning, crew log on receipts and challans.
- **Client portal:** dashboard, support tickets with attachments, profile/GSTIN change requests (admin approves), alert contacts, documents with ZIP download, notifications centre, pay online (Razorpay flag).
- **Admin/manager dashboards, data import (CSV with dry run), system-health page (cron jobs, backups, retention).**
- **Offline:** installable app (manifest + service worker); gate entries, dock counts, temperature readings, scans and attendance are queued on the phone and synced; conflicts are asked, never overwritten.
- **Security:** RLS matrix test (`scripts/rls/build.py` regenerates it), least-privilege grants, fast per-statement RLS, private buckets with signed URLs, CSP in `public/_headers`, rate limits, strong passwords (10+ chars, mixed). Admin sign-in is password only (two-factor is available in the database but switched off).
- **Not finished:** CI pipelines, demo-data seed, pilot guides/UAT/go-live files, Lighthouse tuning, restore drill. See the final report in the chat.
