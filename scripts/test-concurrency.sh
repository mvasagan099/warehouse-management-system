#!/usr/bin/env bash
# Proves document numbers never skip or duplicate under concurrent callers.
# Needs the local Supabase stack (npx supabase start). Cleans up after itself.
set -euo pipefail
DB=$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)
[ -n "$DB" ] || { echo "Local Supabase database container not found. Run: npx supabase start"; exit 1; }
psqlx() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

N=${1:-30}
WH=$(psqlx -c "insert into public.warehouses (code, name) values ('CC', 'Concurrency test') returning id")
trap 'psqlx -c "delete from public.doc_counters where warehouse_id = '"'$WH'"'; delete from public.warehouses where id = '"'$WH'"'" >/dev/null 2>&1 || true' EXIT

OUT=$(mktemp)
for i in $(seq 1 "$N"); do
  psqlx -c "select public.next_doc_number('$WH', 'GRN')" >> "$OUT" &
done
wait

TOTAL=$(wc -l < "$OUT" | tr -d ' ')
UNIQ=$(sort -u "$OUT" | wc -l | tr -d ' ')
NUMS=$(sed -E 's#.*/([0-9]{4})$#\1#' "$OUT" | sort -n | tr '\n' ' ')
EXPECTED=$(seq -f '%04g' 1 "$N" | tr '\n' ' ')
echo "calls=$TOTAL unique=$UNIQ"
if [ "$TOTAL" -eq "$N" ] && [ "$UNIQ" -eq "$N" ] && [ "$NUMS" = "$EXPECTED" ]; then
  echo "PASS: $N concurrent callers got $N unique, gap-free numbers (0001..$(printf '%04d' "$N"))"
else
  echo "FAIL: numbers skipped or duplicated"; sort "$OUT" | head -50; exit 1
fi

# a rolled-back transaction must not consume a number
psqlx <<SQL >/dev/null
begin; select public.next_doc_number('$WH', 'GRN'); rollback;
SQL
NEXT=$(psqlx -c "select public.next_doc_number('$WH', 'GRN')")
EXP=$(printf '%04d' $((N + 1)))
case "$NEXT" in */"$EXP") echo "PASS: a rolled-back document did not consume a number (next is $NEXT)";;
  *) echo "FAIL: expected ...$EXP, got $NEXT"; exit 1;; esac

# ---------------------------------------------------------------------------------------------------------
# Invoice numbers: N draft invoices issued by N parallel sessions get unique, gap-free numbers.
# ---------------------------------------------------------------------------------------------------------
ADMIN=$(psqlx -c "select id from public.profiles where role = 'SUPER_ADMIN' and deleted_at is null limit 1")
[ -n "$ADMIN" ] || { echo "No super admin in the local database (run supabase db reset)"; exit 1; }
WH2=$(psqlx -c "insert into public.warehouses (code, name) values ('CI', 'Invoice concurrency test') returning id")
CL=$(psqlx -c "insert into public.clients (company_name) values ('Concurrency client') returning id")
cleanup_inv() {
  psqlx -c "set session_replication_role = replica;
    delete from public.invoice_tax_lines where invoice_id in (select id from public.invoices where warehouse_id = '$WH2');
    delete from public.invoice_lines where invoice_id in (select id from public.invoices where warehouse_id = '$WH2');
    delete from public.invoices where warehouse_id = '$WH2';
    delete from public.doc_counters where warehouse_id = '$WH2';
    delete from public.clients where id = '$CL';
    delete from public.warehouses where id = '$WH2';" >/dev/null 2>&1 || true
}
trap 'cleanup_inv; psqlx -c "delete from public.doc_counters where warehouse_id = '"'$WH'"'; delete from public.warehouses where id = '"'$WH'"'" >/dev/null 2>&1 || true' EXIT

M=${2:-20}
IDS=$(psqlx <<SQL
with i as (
  insert into public.invoices (client_id, warehouse_id, billing_mode, period_from, period_to, supply_kind, place_of_supply)
  select '$CL', '$WH2', 'BOTH', current_date - 30, current_date - 1, 'INTRA', '33' from generate_series(1, $M) returning id
), l as (
  insert into public.invoice_lines (invoice_id, section, line_no, description, amount_paise, taxable_paise, sac_code, gst_rate_bp, manual)
  select id, 'OTHER', 1, 'Concurrency line', 1000, 1000, '999999', 1800, true from i returning invoice_id
) select invoice_id from l;
SQL
)
OUT2=$(mktemp)
for id in $IDS; do
  psqlx -c "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\",\"role\":\"authenticated\"}', false); select public.issue_invoice('$id')" | tail -1 >> "$OUT2" &
done
wait
TOTAL2=$(grep -c . "$OUT2" || true)
UNIQ2=$(sort -u "$OUT2" | wc -l | tr -d ' ')
NUMS2=$(sed -E 's#.*/([0-9]{4})$#\1#' "$OUT2" | sort -n | tr '\n' ' ')
EXPECTED2=$(seq -f '%04g' 1 "$M" | tr '\n' ' ')
echo "invoices issued=$TOTAL2 unique=$UNIQ2"
if [ "$TOTAL2" -eq "$M" ] && [ "$UNIQ2" -eq "$M" ] && [ "$NUMS2" = "$EXPECTED2" ]; then
  echo "PASS: $M concurrent issue_invoice calls produced $M unique, gap-free invoice numbers"
else
  echo "FAIL: invoice numbers skipped or duplicated"; sort "$OUT2" | head -50; cleanup_inv; exit 1
fi
