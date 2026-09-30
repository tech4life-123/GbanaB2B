# Project status

_Last updated: 2026-09-30 (Phase 2 complete)_

## Current phase

**Phase 2 — Marketplace: complete.** Stopped at the Phase 2 boundary. Next: **Phase 3 — B2B commerce** (addresses, cart, orders, price snapshots, order state machine, proforma invoices).

## Verification (all passing)

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ strict, 0 errors (types generated from the live schema) |
| `npm test` | ✅ 64 unit tests — Phase 1 suite + price-tier validation/lookup, logistics units, image paths, marketplace URL parsing (hostile input), env parsing |
| `npm run test:db` | ✅ 8 migrations apply cleanly on PostgreSQL 16; 106 RLS/workflow assertions (50 Phase 1 + 56 Phase 2) |
| `npm run build` | ✅ production build (Next 16.3, Turbopack) |
| Live Supabase | ✅ project `vdncwiptaheshyomgmsd`: all 8 migrations applied; security advisor shows only the documented intentional warnings + leaked-password protection (dashboard setting) |
| Live site | ✅ https://gbana-b2-b.vercel.app — auto-deploys from `main` |
| Visual check | ✅ marketplace grid + filters, product page estimator, and listing editor reviewed at 1366px and 390px (sample data harness); fixes applied: card footer truncation, select chevrons, equal card heights, one amber action per screen |

## Completed

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
- Ordering, addresses and invoices are Phase 3; "Order with escrow" is visibly disabled.
- Business verification is a manual admin status for now; document-based verification (private bucket) arrives in Phase 4.
- Listing photos are public by design (ADR 0008).
- Vercel image optimisation is used for photos; watch the project's image-transformation quota as listings grow.
- Admin role grant/revoke has no UI yet; no dark mode; automated accessibility and 3G device testing scheduled for Phase 8.

## Unresolved decisions

1. SMS provider for +231 numbers and cost controls.
2. Payment provider onboarding: MTN MoMo and Orange Money merchant accounts + API docs.
3. Fee rounding rule — ADR required before Phase 5.
4. Business verification requirements (registration certificate, TIN, ID of owner) for Phase 4 document review.
5. When to allow multiple businesses per person / team invitations (ADR 0007).
6. Production domain name.

## Next phase — Phase 3: B2B commerce

Delivery addresses; procurement cart (one seller per order); orders + order_items with price, fee and address snapshots; order state machine and status history; seller accept/reject and fulfilment; buyer order tracking; proforma invoices (print/PDF, WhatsApp share).
