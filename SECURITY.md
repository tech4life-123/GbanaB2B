# Security

Security is a product requirement. This document is the threat model and the control list; update it with every phase.

## Assets

1. Money in escrow and the ledger that describes it
2. Identity: phone numbers, national IDs, driver licences, vehicle documents
3. Sealed freight bids (commercially sensitive)
4. Administrative powers (verification, refunds, settings)
5. Audit history

## Threats & controls

| Threat | Control | Status |
| --- | --- | --- |
| User grants themselves admin / changes status | No INSERT/UPDATE on `user_roles`; column grants on `profiles`; `request_role` rejects admin | ✅ tested |
| Role claimed by client | Roles read from DB per request (`getViewer`); RLS uses `has_role()` | ✅ |
| Suspended user keeps acting | `has_role()` requires `profiles.status = 'active'`; `requireRole` redirects | ✅ tested |
| Admin data leak | Admin reads go through RLS admin policies; admin routes 404 for non-admins | ✅ |
| Audit tampering | Trigger blocks UPDATE/DELETE/TRUNCATE for every role; service_role has no update/delete grant | ✅ tested |
| Settings abuse | Admin-only function; type-locked; numeric bounds; audited old→new | ✅ tested |
| Forgotten grants | Default privileges revoked for client roles; PUBLIC execute revoked globally | ✅ tested |
| Open redirect after sign-in | `safeNextPath` allows only same-origin paths | ✅ tested |
| Secret exposure | `server-only` modules for secrets; env validated with Zod; only `NEXT_PUBLIC_*` in bundle | ✅ |
| OTP brute force / SMS pumping | Supabase Auth rate limits (configure in dashboard); generic error messages | ⚙️ configure per project |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, HSTS, referrer policy | ✅ |
| Private pages cached on shared phones | Service worker never caches HTML/API | ✅ |
| PII in logs | Logger redacts phone/otp/token/secret keys | ✅ tested |
| Seller edits another seller's listing | `can_edit_business()` in RLS; column grants; DB re-checks image paths; storage folder policy | ✅ tested |
| Unpublishable/incorrect listings go live | `products_guard` requires weight, tiers from MOQ, active business; `save_product_pricing` validates tiers | ✅ tested |
| Seller self-verifies | `verification_status` not granted; `admin_review_business()` only | ✅ tested |
| Drafts leak publicly | Public pages use anon client; RLS shows only active listings of active businesses | ✅ tested |
| Oversized/malicious uploads | Bucket limit 2 MB, MIME allow-list, client re-encode to WebP/JPEG, path regex | ✅ |
| Buyer tampers with prices or totals | Orders are created only by `place_orders()`, which re-prices from the current tiers; clients have no insert/update on orders or items; items and invoices are immutable | ✅ tested |
| Seller or buyer skips steps / acts for the other party | `transition_order()` checks the actor and the allowed move, needs a reason for seller/admin cancels, and enforces the buyer cancellation window | ✅ tested |
| Order data seen by the wrong party | RLS: buyer, members of the selling business, or admin only; competitors and other buyers see nothing | ✅ tested |
| Overselling | Stock is reserved atomically on confirmation (`quantity_available >= qty`); cancelling restores it | ✅ tested |
| Stale-page double action | `expected_version` optimistic concurrency on transitions | ✅ tested |
| Competitor sees bids | RLS own-rows-only + tests via API, nested relations, Realtime | 🔜 Phase 4 |
| Fake payment success | Only `apply_provider_event` (service role) can fund escrow, and only after the provider adapter verified the signature; browsers can't call it. Amount, currency, provider and reference re-checked in the database; replays stored once | ✅ tested |
| Forged / tampered / replayed webhook | HMAC verified with timing-safe compare before anything is stored; invalid requests dropped and logged; duplicate event ids are no-ops; body size capped | ✅ tested |
| Test provider used in production | `payments.sandbox_enabled` setting (admin-only, audited) + server secret; UI labels it; real providers stay off until verified adapters exist | ✅ |
| Money edited after the fact | Ledger is append-only (update/delete/truncate blocked) and every entry group must balance at commit | ✅ tested |
| Double escrow release / refund after release | `admin_release_escrow` and `admin_refund_escrow` lock the escrow row; a second call is a no-op; refunded funds can't be released and vice versa | ✅ tested |
| Delivery code guessing or leaking | Random 6-digit code readable only by the buyer (RLS; admins and sellers can't read it); attempts counted and the code locks after 5; buyer can regenerate; useless once settled | ✅ tested |
| Release while a claim is open | Open dispute freezes the delivery code, buyer confirm and admin release/refund; only the dispute decision moves money | ✅ tested |
| Double release / refund via different paths | Every release goes through `settle_escrow` and refunds through `refund_escrow_*`, all locking the escrow row; one refund per order | ✅ tested |
| Evidence exposure or tampering | Private bucket; parties and admin only; append-only (no delete); path, type, size and 12-file cap re-checked in the database | ✅ tested |
| Fake or abusive reviews | Buyer of a completed order only, once per subject, inside 30 days, immutable; public columns hide reviewer and order; admin hide is audited and reverses the rating | ✅ tested |
| Stuck or abandoned orders | Unpaid orders expire after 48 h (stock released); silent deliveries release after 72 h; late provider success is parked, not applied | ✅ tested |
| Scheduled-job abuse | `/api/cron/sweep` requires the `CRON_SECRET` bearer (timing-safe); the database function is service-role only | ✅ tested |
| Location tracking of carriers | No continuous GPS: opt-in single point per update, rounded to ~11 m, at most every 120 s | ✅ tested |
| Prompt injection via user text | Everything a user wrote is fenced in `<untrusted>` tags (fence look-alikes stripped), the system prompt says to treat it as data, output must validate against a zod schema or is discarded, and nothing the model returns is executed | ✅ unit tested |
| AI taking a sensitive action | The model has no tools and no write access. It can only return text; approve/release/refund/verify/decide paths don't reference it. Products shown are real catalogue rows found by search; categories are checked against the real list | ✅ by design + tested |
| Personal data sent to the model | Phones, emails and codes are redacted; admin briefing uses a database function that returns aggregates only; dispute summary sends the thread text (redacted), no evidence files | ✅ tested |
| AI cost abuse | Switched off by default; per-person per-minute and per-day quotas taken in the database (`ai_take_quota`) before any model call; role-checked there too; input length capped | ✅ tested |
| Document exposure | Private storage buckets; signed URLs for admins only (listing photos are deliberately public — ADR 0008) | 🔜 Phase 4 |

## Temporary access (pre-launch)

While no SMS provider is configured, `DEMO_ACCESS_ENABLED=true` (Vercel env) shows an email + password form on `/sign-in` for pre-provisioned accounts. Sign-up is not possible through it. Accounts were created directly in `auth.users` via SQL and recorded in the audit log (`account.temporary_access_provisioned`). The admin overview shows a warning banner while it is on.

**To remove:** set `DEMO_ACCESS_ENABLED=false` (or delete it) in Vercel and redeploy, then delete the `*@gbanab2b.test` users in Supabase → Authentication → Users.

## Operational procedures

**First admin:** after the person signs in once, run `select public.bootstrap_admin('+231…');` in the Supabase SQL editor. This is recorded in the audit log. The function is not executable by `anon` or `authenticated`.

**Key handling:** the Supabase secret/service-role key lives only in server environment variables (Vercel, encrypted). Rotate on staff changes. Never paste it into client code, issues or chat.

**Supabase Auth settings to review:** phone provider + SMS rate limits, OTP expiry (≤ 10 min), OTP length 6, disable email sign-ups if unused, **enable leaked-password protection** (flagged by the Supabase advisor while temporary password access is on).

## AI boundary

AI features (Phase 7) may summarise and recommend. They must never approve payments, release escrow, approve refunds, verify identities or drivers, or alter financial records or audit logs. This is enforced structurally: the model is given no tools and no credentials, its context is gathered with the signed-in user's own RLS client (never the service role), and its reply is validated text that is shown, not executed. See `docs/ai/assistants.md` and ADR 0017.

## Reporting

Security issues: contact the maintainers privately. Do not open public issues for vulnerabilities.
