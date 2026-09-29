# Database conventions

- **Identifiers:** `uuid` (`gen_random_uuid()`) for entities; `bigint identity` for append-only logs where ordering matters.
- **Time:** `timestamptz` everywhere; `created_at` default `now()`; `updated_at` maintained by `public.set_updated_at()` trigger.
- **Money:** `bigint` minor units + `currency_code`. Never `numeric` floats for amounts; never a bare amount without currency. Conversions store `exchange_rate` and `rate_captured_at`.
- **Status fields:** Postgres enums or `text` + `check`. Transitions happen in functions, not by client UPDATE.
- **Snapshots:** anything a transaction depends on (price, fee bps, freight bid, exchange rate, addresses) is copied onto the transaction row when created.
- **Append-only:** audit logs, ledger entries, status histories use `public.prevent_mutation()` triggers.
- **Functions:** `SECURITY DEFINER`, `set search_path = ''`, fully-qualified names, explicit `grant execute`. Use `(select auth.uid())` in policies for plan caching.
- **RLS:** enabled on every table in `public`. Separate policies per role intent (`*_select_own`, `*_select_admin`). No INSERT/UPDATE policies for tables that are only written by workflows.
- **Privileges:** revoke by default, grant explicitly (see migration 0001). Column-level `grant update (...)` for user-editable fields.
- **Migrations:** timestamped, forward-only, one concern per file, with a header comment. Every migration ships with SQL tests in `supabase/tests/`.

## Per-table documentation template

Before adding a major table, document here or in `domain-model.md`: purpose · relationships · important fields · constraints · indexes · RLS requirements · lifecycle/state transitions.
