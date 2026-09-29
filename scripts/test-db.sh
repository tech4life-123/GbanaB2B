#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL cluster (with a minimal
# Supabase stub) and runs the SQL test suites. Requires PostgreSQL 15+ server
# binaries (initdb, pg_ctl, psql) on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # initdb refuses to run as root; use the postgres OS user when available.
  chown -R postgres "$WORK" 2>/dev/null && RUN_AS=(runuser -u postgres --)
fi

cleanup() { "${RUN_AS[@]}" pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" initdb -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

echo "→ Supabase stub"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "→ tests $(basename "$f")"
  "${PSQL[@]}" -f "$f" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
done
