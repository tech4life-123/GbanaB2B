# Project status

_Last updated: 2026-09-30 (Phase 3 complete)_

## Current phase

**Phase 3 — B2B commerce: complete.** Stopped at the Phase 3 boundary. Next: **Phase 4 — Freight exchange** (carrier onboarding and verification, RFQs, sealed bids, carrier selection).

## Verification (all passing)

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ strict, 0 errors (types generated from the live schema) |
| `npm test` | ✅ 74 unit tests — adds the order state machine (checked against the database's allow-list for every actor), fee rounding and cart grouping |
| `npm run test:db` | ✅ 10 migrations apply cleanly on PostgreSQL 16; 179 RLS/workflow assertions (50 Phase 1 + 56 Phase 2 + 73 Phase 3) |
| `npm run build` | ✅ production build (Next 16.3, Turbopack) |
| Live Supabase | ✅ all 10 migrations applied; live smoke test (rolled back) placed an order, confirmed it, issued the invoice and reserved stock; advisors show only the documented intentional warnings + leaked-password protection |
| Live site | ✅ https://gbana-b2-b.vercel.app — auto-deploys from `main` |
| Visual check | ✅ order page (buyer + seller), cart, checkout, order list, add-to-cart and invoice reviewed at 1366px and 390px (sample-data harness, removed); fixed a phone-width overflow on two-column pages |

## Completed

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

## Next phase — Phase 4: Freight exchange

Carrier onboarding (driver and vehicle profiles, private document upload), admin verification and badge, freight requests from "ready for pickup" orders, eligibility matching by capacity and route, sealed bidding, and buyer carrier selection (issues invoice revision 2 with freight).
