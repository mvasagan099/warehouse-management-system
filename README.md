# Cold Storage WMS — Phases 1 and 2

Warehouse & cold-storage management for a Tamil Nadu business.

- **Phase 1 (foundation):** auth and roles, warehouses, zones, brigade types and slots, managers and staff, hiring, audit log, dashboard.
- **Phase 2 (operations):** clients and contracts, space booking, gate / lorry entry, inward receipt, stock, QR labels and scanning, dispatch, delivery challan, client portal.
- **Not built yet (Phase 3):** rate cards, rent and labour calculation, invoices, GST amounts, payments, temperature sensors. The facts they need (slot allocation dates, labour hours) are already stored.
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
npm test                  # Vitest (111): schemas, GSTIN, roles, receipt / pick / stock logic, i18n key coverage, route guards, create-user rules
npm run test:db           # pgTAP (174): RLS per role, confirm functions, FEFO, rollback, numbering, cancellation (needs `supabase start`)
npm run test:concurrency  # 30 parallel sessions: document numbers never skip or duplicate
npm run test:e2e          # Playwright: client -> booking -> gate -> receipt (+PDF) -> dispatch -> scan -> challan -> client portal
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
| Migrations | applied by `supabase db reset` | 12 migrations applied (5 for Phase 1, 7 for Phase 2); versions match the files in `supabase/migrations` |
| Edge Function | `npx supabase functions serve` | `create-user` deployed (verify JWT on) |

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

- Money is integer **paise** (`credit_limit_paise`, `security_deposit_paise`; no other money exists until Phase 3) (`bigint`), helpers in `src/lib/money.ts`. No floats.
- Timestamps are `timestamptz` (UTC) and displayed in `Asia/Kolkata` (`src/lib/format.ts`).
- Sizes, temperatures, rates live in tables, not code (brigade dimensions, zone temperature bands, expiry alert days in `app_settings`).
- Soft delete (`deleted_at`) everywhere; queries filter `deleted_at is null`. `audit_logs` is append-only.
- After a schema change: add a migration, `npx supabase db reset`, `npm run db:types`.

## Extension points (Phase 3, not built)

Rate cards, rent and labour calculation, invoices, GST amounts, payments, temperature sensors and alerts.
Already stored for them: `contracts.rate_card_id`, `slot_allocations` (client, slot, start and end date, per brigade type),
`labour_entries` (activity, packages, tonnes, workers, hours), `stock_movements`, paise helpers in `src/lib/money.ts`,
and the generic audit trigger (attach to new tables with one `create trigger`).

## Notes

- PDFs (receipt, challan) are printed in English: the built-in PDF font has no Tamil glyphs. Embed a Tamil font in `src/features/pdf/documents.tsx` to print Tamil.
- A client login can be created only by an administrator (Clients -> Create login); the temporary password must be changed at first sign-in.
