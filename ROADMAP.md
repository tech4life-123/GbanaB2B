# Roadmap

Each phase ends only when its definition of done is met: UI, server logic, data model, authorisation, validation, error/loading/empty states, responsive + accessible, tests, lint, typecheck, build, docs.

| # | Phase | Scope | Status |
| --- | --- | --- | --- |
| 1 | Foundation | App shell, design system, PWA, env architecture, phone auth, roles, migrations + RLS baseline, audit log, platform settings, admin foundation, tests, docs | ✅ Done |
| 2 | Marketplace | Businesses & members, categories, products, images (Storage), specs, MOQ, price tiers, search/filter, product & seller pages, seller listing tools, admin categories & business review | ✅ Done |
| 3 | B2B commerce | Delivery addresses, procurement cart, orders + items, price snapshots, order state machine, seller/buyer order management, proforma invoices (print/PDF/WhatsApp share) | ✅ Done |
| 4 | Freight exchange | Driver onboarding, vehicles, private document upload, verification workflow + badge, RFQs, cargo calculation, eligibility matching, sealed bidding, carrier selection & assignment | ✅ Done |
| 5 | Financial engine | PaymentProvider adapters (MTN MoMo, Orange Money) from verified docs, sandbox provider, payment transactions, escrow, double-entry ledger, fees, exchange rates, webhooks, idempotency, reconciliation, payouts | ✅ Done |
| 6 | Delivery & trust | Delivery lifecycle, Leaflet/OSM tracking, secure delivery codes, disputes + evidence, refunds, reviews, ratings, trust signals | ✅ Done |
| 7 | AI | Buyer, seller-listing, freight and admin-analytics assistants — permission-aware, advisory only | ✅ Done |
| 8 | Production hardening | Security & RLS audit, performance on 3G/low-end devices, accessibility audit, payment failure & concurrency testing, monitoring, deployment runbooks | ✅ Done |

**After Phase 8** (recommended order): launch checklist and a pilot (`docs/operations/launch-checklist.md`) → real MTN/Orange adapters when documentation arrives → Phase 9 services marketplace (service listings, quotes, milestone escrow) → Phase 10 real-estate and land vertical with stricter verification and legal review.

Future (not scheduled): more countries & currencies, warehouse management, business credit, purchase orders & recurring procurement, fleet management, insurance, customs, public API, native apps.
