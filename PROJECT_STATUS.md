# Project status

_Last updated: 2026-09-30 (Phase 5 complete, test provider only)_

## Current phase

**Phase 5 — Financial engine: complete (built against a test provider).** MTN MoMo and Orange Money are **not connected** — they need provider API access and credentials. Stopped at the Phase 5 boundary. Next: **Phase 6 — Delivery & trust** (delivery lifecycle, secure delivery code, disputes, refunds with evidence, reviews).

## Verification (all passing)

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ strict, 0 errors (types generated from the live schema) |
| `npm test` | ✅ 93 unit tests — adds the order state machine (checked against the database's allow-list for every actor), fee rounding and cart grouping |
| `npm run test:db` | ✅ 12 migrations apply cleanly on PostgreSQL 16; 378 RLS/workflow assertions (… + 109 for Phase 5) |
| `npm run build` | ✅ production build (Next 16.3, Turbopack) |
| Live Supabase | ✅ all 12 migrations applied; live smoke test (rolled back) placed an order, confirmed it, issued the invoice and reserved stock; advisors show only the documented intentional warnings + leaked-password protection |
| Live site | ✅ https://gbana-b2-b.vercel.app — auto-deploys from `main` |
| Visual check | ✅ order page (buyer + seller), cart, checkout, order list, add-to-cart and invoice reviewed at 1366px and 390px (sample-data harness, removed); fixed a phone-width overflow on two-column pages |

## Completed

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

## Known limits (Phase 5)

- **Test provider is ON** (`payments.sandbox_enabled`). Turn it off before real launch. No real money moves.
- Payouts and refunds are recorded by an admin after sending; automated disbursement waits for real provider APIs.
- Escrow release is an admin decision until Phase 6's delivery code. Partial refunds arrive with disputes.
- Orders stuck in `awaiting_payment` can't be cancelled yet (Phase 6 adds expiry).
- Webhook endpoint has no rate limiting yet (Phase 8).

## Next phase — Phase 6: Delivery & trust

Delivery lifecycle and tracking, secure delivery code that releases escrow, disputes with private evidence, refunds, reviews and ratings.
