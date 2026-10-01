#!/usr/bin/env bash
# Race-condition tests against a throwaway PostgreSQL cluster: many real
# connections fire the same operation at once, then we check that exactly the
# right number succeeded and the books still balance. Same prerequisites as
# scripts/test-db.sh.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54331}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK" 2>/dev/null && RUN_AS=(runuser -u postgres --); fi
cleanup() { "${RUN_AS[@]}" pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" initdb -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c max_connections=100" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -q -At)

"${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "migration failed: $f"; exit 1; }; done
"${PSQL[@]}" -f "$ROOT/supabase/tests/concurrency/setup.sql" >/dev/null 2>"$WORK/setup.err" || { cat "$WORK/setup.err"; echo "fixture setup failed"; exit 1; }

PASS=0; FAIL=0
expect() { # label actual expected
  if [ "$2" = "$3" ]; then echo "  PASS  $1 ($2)"; PASS=$((PASS+1)); else echo "  FAIL  $1 — got $2, expected $3"; FAIL=$((FAIL+1)); fi
}
q() { "${PSQL[@]}" -c "$1"; }
id() { q "select v from public.zz_ids where k = '$1'"; }

# Runs SQL as one user in one transaction on its own connection; prints OK or ERR.
as() { # uid role sql outfile
  local f; f="$(mktemp -p "$WORK")"
  printf "begin;\nselect set_config('request.jwt.claims', json_build_object('sub', '%s', 'role', 'authenticated')::text, true);\nset local role %s;\n%s;\ncommit;\n" "$1" "$2" "$3" > "$f"
  if out="$("${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$f" 2>&1)"; then echo "OK $(echo "$out" | tail -1)" > "$4"; else echo "ERR $(echo "$out" | head -1)" > "$4"; fi
}
count() { cat "$WORK"/out.$1.* 2>/dev/null | grep -c "^$2"; }

echo "→ 5 orders for the last 10 bags, all confirmed by the seller at once"
# Stock is reserved when the seller confirms, so that is the moment two orders can collide.
for n in 1 2 3 4 5; do as "c0000000-0000-0000-0000-0000000000e$n" authenticated "select (public.place_orders((select id from public.addresses where profile_id = auth.uid() limit 1)))[1]" "$WORK/out.place.$n"; done
expect "all five orders are accepted (nothing is promised yet)" "$(count place OK)" 5
for oid in $(q "select distinct o.id from public.orders o join public.order_items i on i.order_id = o.id where i.product_id = '$(id scarce)'"); do
  as c0000000-0000-0000-0000-00000000000a authenticated "select public.transition_order('$oid', 'confirmed')" "$WORK/out.oversell.$oid" &
done; wait
expect "exactly one order gets the stock" "$(count oversell OK)" 1
expect "the other four are refused" "$(count oversell ERR)" 4
expect "stock never goes negative" "$(q "select quantity_available from public.products where title = 'Con scarce'")" 0
expect "exactly one order is confirmed" "$(q "select count(*) from public.orders o join public.order_items i on i.order_id = o.id where i.product_id = '$(id scarce)' and o.status = 'confirmed'")" 1

echo "→ 8 admins release the same escrow at once"
O1="$(id o1)"
for n in 1 2 3 4 5 6 7 8; do as c0000000-0000-0000-0000-000000000009 authenticated "select public.admin_release_escrow('$O1', 'race test')" "$WORK/out.release.$n" & done; wait
expect "exactly one call actually released" "$(count release 'OK t')" 1
expect "the others were harmless no-ops" "$(count release 'OK f')" 7
expect "escrow released once" "$(q "select count(*) from public.escrow_accounts where order_id = '$O1' and status = 'released'")" 1
expect "two payouts (seller + carrier), not sixteen" "$(q "select count(*) from public.payouts where order_id = '$O1'")" 2
expect "one balanced release group of four ledger entries" "$(q "select count(*) from public.ledger_entries where kind = 'escrow_released' and order_id = '$O1'")" 4
expect "platform fee recognised once" "$(q "select balance_minor from public.ledger_balances where account = 'platform_fees' and currency = 'USD'")" 600

echo "→ 8 copies of the same payment webhook arrive together"
T2="$(id t2)"
for n in 1 2 3 4 5 6 7 8; do as c0000000-0000-0000-0000-000000000009 service_role "select public.apply_provider_event('sandbox', 'evt-race-1', '$T2', 'SBX-C2', 'succeeded', 29000, 'USD', '{}')" "$WORK/out.hook.$n" & done; wait
expect "exactly one delivery applied the payment" "$(count hook 'OK applied')" 1
expect "no delivery failed" "$(count hook ERR)" 0
expect "one escrow account for the order" "$(q "select count(*) from public.escrow_accounts where order_id = '$(id o2)'")" 1
expect "one funding ledger group for the order" "$(q "select count(distinct entry_group) from public.ledger_entries where order_id = '$(id o2)' and kind = 'escrow_funded'")" 1
expect "the event is stored once" "$(q "select count(*) from public.provider_events where event_id = 'evt-race-1'")" 1

echo "→ two people confirm the same order version"
O3="$(id o3)"; V="$(q "select version from public.orders where id = '$O3'")"
for n in 1 2; do as c0000000-0000-0000-0000-00000000000a authenticated "select public.transition_order('$O3', 'confirmed', null, $V)" "$WORK/out.trans.$n" & done; wait
expect "exactly one transition wins" "$(count trans OK)" 1
expect "the loser is told it changed" "$(count trans ERR)" 1
expect "history records the move once" "$(q "select count(*) from public.order_status_history where order_id = '$O3' and to_status = 'confirmed'")" 1

echo "→ 20 assistant requests in the same second (limit is 6 per minute)"
for n in $(seq 1 20); do as c0000000-0000-0000-0000-00000000000b authenticated "select public.ai_take_quota('buyer')" "$WORK/out.ai.$n" & done; wait
expect "no more than the per-minute limit got through" "$(count ai OK)" 6
expect "usage log matches" "$(q "select count(*) from public.ai_usage")" 6

echo
echo "concurrency: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
