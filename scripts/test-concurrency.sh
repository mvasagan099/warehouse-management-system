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
