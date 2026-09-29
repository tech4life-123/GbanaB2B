# Database

Source of truth: `supabase/migrations/`. Detailed conventions: [docs/database/README.md](docs/database/README.md).

## Phase 1 schema

| Table | Purpose | Written by |
| --- | --- | --- |
| `profiles` | Personal account data, 1:1 with `auth.users`. E.164 phone mirrored by trigger. | Trigger on sign-up; users may update `full_name`, `display_name`, `preferred_currency`, `locale` only (column grants) |
| `user_roles` | Role grants, many per user, with revocation history | `request_role`, `complete_onboarding`, `grant_role`, `revoke_role`, `bootstrap_admin` |
| `platform_settings` | Configurable business rules (fee in bps, OTP windows, bid expiry…) with type + bounds | `update_platform_setting` (admin only) |
| `audit_logs` | Append-only record of sensitive actions | `write_audit_log` (internal) — UPDATE/DELETE/TRUNCATE blocked by trigger for every role |

Enums: `app_role`, `account_status`, `role_status`, `currency_code (USD, LRD)`.

## RLS matrix (Phase 1)

| Table | anon | authenticated (self) | admin | service_role |
| --- | --- | --- | --- | --- |
| profiles | — | select/update own row (limited columns) | select all | all |
| user_roles | — | select own | select all | all |
| platform_settings | — | select non-sensitive | select all | all |
| audit_logs | — | — | select | select, insert (no update/delete) |

All mutations of roles/settings go through `SECURITY DEFINER` functions with `search_path = ''`, which validate the caller, enforce the rule and write the audit record in one transaction.

## Default privileges

Migration 0001 revokes default grants on new tables/functions from client roles. Every table and function must grant explicitly — so forgetting a grant fails closed.

## Testing

`npm run test:db` spins up a disposable PostgreSQL, loads a minimal Supabase stub (`auth.users`, `auth.uid()`, roles), applies every migration and runs `supabase/tests/*.sql`. Phase 1 covers 40+ scenarios: self-escalation attempts, column-level protection, cross-user reads, anon access, suspension, setting bounds, and audit immutability.

## Planned domains

Documented in [docs/database/domain-model.md](docs/database/domain-model.md): businesses, products & price tiers, orders & snapshots, freight RFQs & sealed bids, payments/escrow/ledger, verification, disputes, notifications.
