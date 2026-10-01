# Project status

_Last updated: 2026-10-01 (Phase 8 complete; payments still on the test provider; AI not yet connected)_

## Current phase

**Phase 8 — Production hardening: complete as far as can be done without real providers and a real device.** Two real security/correctness issues were found and fixed (private business columns readable by anyone; AI quota race). Not launch-ready yet: MTN MoMo/Orange Money are **not connected** (test provider), SMS is on hold (temporary email+password access), AI shows "not connected" until a key is set, and the launch checklist (`docs/operations/launch-checklist.md`) has owner-only items. Stopped at the Phase 8 boundary; the original eight phases are done.

## Verification (all passing)

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ strict, 0 errors (types generated from the live schema) |
| `npm test` | ✅ 130 unit tests (adds AI helpers, rate limiter) |
| `npm run test:db` | ✅ 16 migrations apply cleanly on PostgreSQL 16; 616 RLS/workflow assertions (… + 22 Phase 8 audit) |
| `npm run test:concurrency` | ✅ 21 assertions, parallel connections: stock confirmation, double escrow release, duplicate webhooks, same-version transitions, AI quota |
| `npm run build` | ✅ production build (Next 16.3, Turbopack) |
| Live Supabase | ✅ all 13 migrations applied (39 Phase 6 function bodies verified identical to local); live smoke test (rolled back) placed an order, confirmed it, issued the invoice and reserved stock; advisors show only the documented intentional warnings + leaked-password protection |
| Live site | ✅ https://gbana-b2-b.vercel.app — auto-deploys from `main` |
| Visual check | ✅ Phase 7: all assistant forms and not-connected/switched-off states at 1366px and 390px (harness removed). Phase 6: delivery code card, carrier job controls (pickup/in transit/arrived), dispute page with admin decision form, reviews and trust summary at 1366px and 390px (sample-data harness, removed). Earlier: order page (buyer + seller), cart, checkout, order list, add-to-cart and invoice reviewed at 1366px and 390px (sample-data harness, removed); fixed a phone-width overflow on two-column pages |

## Completed

### Phase 8 — Production hardening
- **RLS/privilege audit:** structural checks run locally (`80_phase8_audit.sql`) and on the live project. Fixed: public and signed-in readers could read every column of active `businesses` rows (admin verification note, owner id, address, phones, registration number) — now column-level grants (ADR 0018).
- **Concurrency:** `scripts/test-concurrency.sh`. Found and fixed an AI-quota race (8 of 20 simultaneous requests passed a limit of 6). Confirmed: one order gets the last stock, one escrow release, one webhook applied, one order transition per version.
- **Security headers and limits:** production CSP; webhook rate limits (per caller, bad signatures); health check rate limit; `x-request-id` on responses.
- **Monitoring:** `/api/health` (liveness) and `?deep=1` (database readiness); admin overview shows scheduled-jobs and AI status; runbook with log events to search.
- **Accessibility (scripted, public pages):** axe-core WCAG A/AA at 1366 and 390 — fixed footer/sign-in contrast and missing page heading on not-found pages; now zero violations. `scripts/a11y-audit.py`.
- **3G check:** `scripts/perf-3g.py` — pages transfer 205–280 KB; first paint ~0.8 s on Fast 3G and ~2.3 s on Slow 3G; largest paint ≤ 4.3 s on Slow 3G.
- **Database performance:** advisor reports no unindexed foreign keys; the 67 "unused index" notices are expected with no traffic and were left alone.
- Docs: `docs/operations/runbook.md`, `docs/operations/launch-checklist.md`, security audit summary, ADR 0018.

### Phase 7 — AI assistants
- **Buyer** `/buyer/assistant`: describe a need → the AI proposes ≤4 search phrases and quantity/MOQ notes; the server then searches the real catalogue, so products are never invented.
- **Seller** `/seller/assistant`: rough notes → draft title, description, specs and a category (validated against the real list) to copy into the normal listing form. Nothing is saved or published.
- **Freight** (buyer and seller): vehicle class from the platform's weight bands (deterministic) plus AI packing/handover tips.
- **Admin** `/admin/assistant`: database-computed marketplace snapshot (7/30/90 days; aggregates only) with an optional plain-language briefing; "Summarize" on each dispute page (neutral recap; never an outcome or amount).
- Controls: off by default (`ai.enabled`), per-person per-minute and per-day quotas and role checks in the database (`ai_take_quota`), usage log without prompts or answers, input cap, redaction, untrusted-text fencing, schema-validated output.
- Docs: `docs/ai/assistants.md`, ADR 0017, SECURITY.md rows.

### Phase 6 — Delivery & trust
- **Delivery:** carrier `/carrier/deliveries` (active / delivered / cancelled) and a job page: collect goods → post updates (optional one-off approximate location, rate-limited) → arrived → enter the buyer's 6-digit code (5 tries then locked) or report a failed delivery. Order pages show the tracking trail to buyer, seller and admin.
- **Delivery code:** buyer-only card (hidden until shown), regenerate, or confirm receipt in the app; release happens through one database path; silence for 72 h releases automatically.
- **Disputes:** any party opens one while money is in escrow (freezes release/refund); conversation thread; private photo/video evidence (browser re-encode, direct upload, 12-file cap); opener can withdraw; `/buyer|seller|carrier|admin/disputes`; admin decision console (start review; refund, partial refund paid by seller's or carrier's share, release, reject; fault; written explanation; audited).
- **Reviews & trust:** buyers rate seller and carrier once after completion (30 days, immutable); subjects reply once; admin hides with an audited reason (`/admin/reviews`); ratings and completed/upheld counts on public seller pages and beside each carrier bid; `/seller/reviews`, `/carrier/reviews`.
- **Unpaid orders:** buyer/admin can cancel before payment; expire after 48 h; nightly `/api/cron/sweep` (needs `CRON_SECRET`) plus an admin "Run housekeeping now" button.
- Docs: `docs/database/delivery-and-trust.md`, `docs/workflows/delivery-and-disputes.md`, ADR 0016, SECURITY.md threat rows.

### Phase 5 — Financial engine
- **Buyer:** after booking a carrier, pay the order total from the order page (amount comes from the database, one reference per form so a double-tap can't double-charge); waiting state; escrow card; `/buyer/payments`
- **Provider layer:** `PaymentProvider` interface, **test provider** (signed webhooks, no real money, switchable by admin), MTN/Orange placeholders that refuse to run; webhook route with signature check, body cap and idempotency; status-query reconciliation
- **Escrow + ledger:** escrow per order, append-only balanced double-entry ledger, platform fee/seller/carrier shares fixed at funding; admin release and full refund (written reason, audited, idempotent)
- **Payouts:** seller `/seller/payouts` and carrier `/carrier/earnings` views; admin `/admin/finance` (balances, needs-attention list, exchange rates), `/admin/finance/payments`, `/admin/finance/payouts` (start → record result with provider reference)
- **Config:** `payments.*` settings, exchange-rate history (admin, audited). `SANDBOX_WEBHOOK_SECRET` set on Vercel (server only)
- Docs: `docs/database/payments.md`, `docs/payments/adding-a-provider.md`, ADR 0014, ADR 0015, SECURITY.md threats


### Phase 4 — Freight exchange
- **Carrier:** onboarding (profile, coverage counties, vehicles, private document upload, submit for review), load board filtered to eligible loads, load page with sealed bid form, My bids
- **Buyer/seller/admin:** request freight from "ready for pickup" orders, compare sealed bids (lowest/fastest hints), book one (invoice revision 2 with carrier + ETA); sellers see only the booked carrier
- **Admin:** `/admin/verification` queue and carrier review (signed document links, vehicle verification, approve/ask for changes/suspend with audited notes); `/admin/freight`
- **Database:** `freight.md`, ADR 0012 (private documents, human verification), ADR 0013 (sealed bids, eligibility); live migration function bodies verified identical to local
- Visual check: freight panel (bidding, seller view, booked) and load card reviewed at 1366px and 390px


### Phase 3 — B2B commerce
**Buyer**
- Product page: quantity + live tier estimate + **Add to cart** in one form; sign-in / add-buyer-role / "this is your listing" states
- `/buyer/cart`: grouped by seller (one order per seller and currency), per-line tier price, next-tier savings hint, MOQ/stock/unavailable warnings, cargo weight and carrier class
- `/buyer/checkout`: pick a saved address (or add the first one inline), optional business name for the invoice, note to seller; places all orders at once
- `/buyer/addresses`: up to 20, one default, edit/delete
- `/buyer/orders` + order page: stage tracker, next-step hint, locked-price items, totals, history, cancel (free while pending, or within 60 min after confirmation — setting)
- Overview shows real order counts, active orders and a setup checklist

**Seller**
- `/seller/orders` tabs (New / Preparing / Ready / Closed / All) showing proceeds after fee; order page with Accept → Start preparing → Mark ready for pickup, and Cancel with a reason
- Accepting reserves stock (never oversells) and issues the proforma invoice
- Overview flags new orders

**Admin**
- `/admin/orders` with search by order number and status tabs; order page with audited cancel-with-reason

**Proforma invoice** — `/orders/[id]/invoice`: A4 print layout, "Print or save PDF", WhatsApp share (summary + link that only the order's parties can open), immutable snapshot, validity date, escrow terms

**Database** — `20260930000400_commerce.sql`, `…0500_commerce_indexes.sql`. See [docs/database/commerce.md](docs/database/commerce.md), ADR 0010 (fee rounding) and ADR 0011 (orders per seller, snapshots).


### Phase 2 — Marketplace
**Public (no sign-in needed)**
- `/marketplace`: full-text search, category chips, filters (category, seller county, unit price range + currency, max MOQ, in stock), sort (newest, price ↑/↓, lowest MOQ), pagination; GET-form filters work without JavaScript and every result is a shareable URL
- `/products/[slug]`: photo gallery (scroll-snap, lazy), quantity price-tier table with savings, live order estimator (tier, subtotal, cargo weight, carrier class), shipping details, specifications, seller card with verification, related listings, WhatsApp share, schema.org Product data; "Order with escrow" shown disabled until Phase 3
- `/sellers/[slug]`: seller profile and live listings
- Session-aware header ("My workspace" when signed in)

**Seller workspace**
- Business profile: create (seller role required, one owned business per person — ADR 0007) and edit; verification status and admin notes
- Listings list with status filters and counts
- New listing → editor with sections: prices & stock (MOQ, contiguous tier builder with live validation and buyer preview), photos (browser compression to WebP ≤1600px, direct upload to Storage, cover selection, delete, max 8), shipping details (weight, dimensions, fragile, stacking, handling), product details, specifications
- Publish checklist (weight + tiers from MOQ required; photo + description recommended); publish / pause / archive; delete drafts
- Overview with live/draft/paused/archived counts and setup checklist

**Admin**
- Businesses: filter by verification/suspension; review dialog sets verification + status with note (rejection requires reason; suspension pauses listings); audited
- Categories: create/edit/hide, audited; 20 Liberia-relevant categories seeded

**Database** — `20260930000100_marketplace.sql`, `…0200_product_image_storage.sql`, `…0300_products_slug_default.sql`. See [docs/database/marketplace.md](docs/database/marketplace.md).

### Phase 1 — Foundation
App shell, design system (`/design-system`), PWA, env architecture, phone OTP auth + temporary password access, roles, workspaces, admin (users, settings, audit), migrations 0001–0005, docs, CI. Details in git history and ARCHITECTURE.md.

## Known limitations

- **Temporary access is ON.** `/sign-in` offers email + password for `owner@gbanab2b.test` (all four roles) and `newuser@gbanab2b.test` (none). Turn off with `DEMO_ACCESS_ENABLED=false` once SMS works — see SECURITY.md.
- **SMS sign-in not yet configured** (needs an SMS provider in Supabase Auth).
- **Enable leaked-password protection** in Supabase Auth settings while password access is on (advisor warning).
- The marketplace is empty until sellers publish — no demo listings are seeded on purpose.
- Price filter compares each listing's lowest tier price within one currency; USD/LRD conversion arrives with exchange rates in Phase 5.
- Product variants (sizes/colours under one listing) deferred — sellers create one listing per pack size.
- Freight and payment aren't live yet: orders stop at "Ready for pickup". The invoice shows freight as "to be quoted" and payment as unpaid.
- No notifications yet (SMS/push). Buyers and sellers see updates when they open their orders.
- Invoices are printed to PDF by the browser; there is no server-generated PDF.
- Business verification is a manual admin status for now; document-based verification (private bucket) arrives in Phase 4.
- Listing photos are public by design (ADR 0008).
- Vercel image optimisation is used for photos; watch the project's image-transformation quota as listings grow.
- Admin role grant/revoke has no UI yet; no dark mode; automated accessibility and 3G device testing scheduled for Phase 8.

## Unresolved decisions

1. SMS provider for +231 numbers and cost controls.
2. Payment provider onboarding: MTN MoMo and Orange Money merchant accounts + API docs.
3. Confirm the fee rounding in ADR 0010 (half-up, seller-side) when the Phase 5 ledger is designed.
4. Business verification requirements (registration certificate, TIN, ID of owner) for Phase 4 document review.
5. When to allow multiple businesses per person / team invitations (ADR 0007).
6. Production domain name.

## Known limits (Phase 6)

- **Test provider is ON** (`payments.sandbox_enabled`). Turn it off before real launch. No real money moves. Payouts and refunds are still recorded by an admin after sending.
- **`CRON_SECRET` must be set on Vercel** for the nightly sweep to run (the route refuses without it). Vercel Hobby runs cron at most once a day, so auto-release can be up to a day late.
- Carriers can't read orders (by design); the freight request number is their job reference.
- No map SDK: approximate locations open in OpenStreetMap. No SMS/push notifications yet — people see updates when they open the app.
- Refunds happen only through disputes (full or partial); there is no buyer-initiated refund outside a dispute.
- Webhook endpoint has no rate limiting yet (Phase 8).

## Known limits (Phase 7)

- **No live model call has been tested**: no provider key exists yet. The adapter is unit-tested against mocked responses only. Expect to tune prompts after the first real calls.
- A quota unit is used even if the model call then fails (the database takes it first).
- The dispute summary cannot see photos or videos, only the text.

## Known limits (Phase 8)

- Accessibility was scanned on public pages only; signed-in screens still need a manual pass (script supports it with a saved session).
- 3G numbers are from a local production build with emulated throttling, not a real phone in Liberia.
- In-app rate limits are per server instance; add Vercel Firewall rules for a global limit (runbook).
- CSP keeps `script-src 'unsafe-inline'` for Next.js bootstrap scripts; nonces are a later improvement.
- No third-party penetration test yet. Payment failure paths are tested against the test provider only.

## Next

Owner actions in `docs/operations/launch-checklist.md`, then a pilot. After that: Phase 9 services marketplace (see recommendation), real provider adapters once MTN/Orange documentation arrives.
