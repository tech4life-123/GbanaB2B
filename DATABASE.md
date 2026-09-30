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

## Phase 2 schema (marketplace)

`businesses`, `business_members`, `product_categories`, `products`, `product_price_tiers`, `product_specifications`, `product_images`, view `product_listings`, and the public `product-images` storage bucket. Full write-up: [docs/database/marketplace.md](docs/database/marketplace.md).

Workflow functions: `create_business`, `save_product_pricing`, `save_product_specifications`, `admin_review_business`. Integrity triggers: `products_guard` (publish rules, immutable slug/business, archive is terminal), `product_images_limit` (path + max 8), category audit.

## Phase 3 schema (commerce)

`addresses`, `cart_items`, `orders`, `order_items`, `order_status_history`, `proforma_invoices`, enum `order_status`. Orders are created only by `place_orders()` and change status only through `transition_order()`. Items, history and invoices are immutable. Full write-up: [docs/database/commerce.md](docs/database/commerce.md).

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

`npm run test:db` spins up a disposable PostgreSQL, loads a minimal Supabase stub (`auth.users`, `auth.uid()`, roles), applies every migration and runs `supabase/tests/*.sql`. Phase 1 covers 50 scenarios, Phase 2 another 56 and Phase 3 another 73 (179 total): self-escalation attempts, column-level protection, cross-user reads, anon access, suspension, setting bounds, and audit immutability.

## Planned domains

Documented in [docs/database/domain-model.md](docs/database/domain-model.md): freight RFQs & sealed bids, payments/escrow/ledger, verification, disputes, notifications.
