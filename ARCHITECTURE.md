# Architecture

GbanaB2B is one Next.js application backed by one Supabase project. It is deliberately a **modular monolith**: domain modules with clear boundaries inside a single deployable, so the team can move fast now and split services later only if load demands it.

## Guiding priorities

When requirements conflict: **data integrity → financial correctness → security → authorisation → reliability → maintainability → performance → UX → visual polish.**

## Layers

```
Browser (PWA)
  │  React Server Components render HTML; small client islands for forms/menus
  ▼
Next.js (Vercel)
  proxy.ts ............ refresh Supabase session cookie; optimistic redirect for signed-out users
  app/ routes ......... thin: read params, call feature services, render
  features/*/actions .. Server Actions — validate (Zod) → authorise → call DB workflow → map errors
  features/*/queries .. server-only read models
  lib/ ................ cross-cutting primitives (auth, db clients, money, state machines, logging)
  ▼
Supabase
  Auth ................ phone OTP; identity only
  PostgreSQL .......... tables + RLS + SECURITY DEFINER workflow functions + append-only audit
  Storage ............. private buckets for verification documents & evidence (Phase 4/6)
```

### Where rules live

| Concern | Enforced in | Why |
| --- | --- | --- |
| Input shape | Zod schemas in `features/*/schemas.ts` | Friendly errors, typed data |
| Who may act | `requireRole()` in layouts/actions **and** RLS / function checks | UI checks are for UX; the database is the boundary |
| State transitions | `lib/state-machine.ts` on the server **and** DB functions/triggers | A bypassed API still can't corrupt state |
| Money | Integer minor units + currency (`lib/money`); ledger in Phase 5 | No float drift; auditable |
| Business rules (fee, OTP windows…) | `platform_settings` rows, changed via audited function | Configurable without deploys; no magic numbers |

Clients never send "set status = X". They request an **action** (`complete_onboarding`, later `accept_bid`, `confirm_delivery`), and the server decides whether that action is allowed from the current state.

## Supabase clients

| Client | File | Key | RLS |
| --- | --- | --- | --- |
| Server (per request) | `lib/db/supabase/server.ts` | publishable | Applies — runs as the user |
| Browser | `lib/db/supabase/browser.ts` | publishable | Applies |
| Admin | `lib/db/supabase/admin.ts` (`server-only`) | secret | **Bypassed** — only for webhooks/jobs after explicit authorisation |

Admin screens use the *server* client, not the admin client: admin visibility comes from `*_select_admin` RLS policies, so a missing admin role yields empty results rather than leaked data.

## Roles

`buyer`, `seller`, `carrier`, `admin` in `public.user_roles` (many per user). The first three are self-assignable through `request_role`; `admin` only via `grant_role` (admin) or `bootstrap_admin` (SQL editor). A suspended account holds no effective roles (`has_role` checks account status). Carrier *verification* is a separate, admin-controlled record (Phase 4) — holding the carrier role never implies it.

## Front end

- **Route groups:** `(site)` static marketing + design system; `(market)` public marketplace (session-aware header, cookie-less anon data client — ADR 0009); `(auth)` split-screen sign-in & onboarding; `(workspace)` role workspaces gated server-side by `RoleWorkspace`.
- **Workspace shell:** navy sidebar on desktop; top bar + 4-item bottom tab bar on phones. Navigation is config (`features/workspace/nav.ts`); sections from later phases render an honest "opens in phase N" page — no simulated data.
- **Design system:** `components/ui` primitives + `components/brand` (logo, trade path). Tokens in `app/globals.css`. Living reference at `/design-system`. See [docs/architecture/design-system.md](docs/architecture/design-system.md).
- **Performance budget:** RSC-first, ~75 KB of self-hosted fonts (mono not preloaded), SVG logo, no animation libraries, `<details>`/`<dialog>` instead of JS widgets where possible.

## Marketplace data flow

- **Browse/search:** `features/marketplace/search-params.ts` turns untrusted URL params into a safe query (malformed values dropped) → `queries.ts` hits the `product_listings` view with Postgres full-text search, filters and pagination. Filters are a plain GET form: works without JS and every result page is a shareable link.
- **Seller writes:** server actions in `features/seller/actions.ts` validate with Zod, check ownership, then call DB functions (`save_product_pricing`, …) or RLS-protected updates. Pricing rules are mirrored in `lib/pricing/tiers.ts` for instant feedback; the database is authoritative.
- **Photos:** compressed in the browser (`lib/storage/compress.ts`) → uploaded directly to Storage (folder policy) → registered by a server action that re-validates the path. Served via `next/image` (AVIF/WebP, sized per device, quality 60 in grids).

## Ordering data flow

- **Cart:** `cart_items` rows (server-side, per profile). The cart page groups lines with `lib/orders/cart.ts` exactly as checkout will split them (one order per seller and currency) and flags MOQ, stock and availability problems before the buyer tries to check out.
- **Checkout:** `placeOrders` action → `place_orders()` in the database, which re-prices and validates everything inside one transaction. The client never sends prices.
- **Lifecycle:** order pages compute the allowed actions with `lib/orders/state.ts` (UI only). Each action posts to `transitionOrder` → `transition_order()`, which is authoritative (actor, state, reason, cancellation window, stock, version).
- **Invoices:** `/orders/[id]/invoice` renders the immutable proforma snapshot. Print CSS gives an A4 page, and the browser's "Save as PDF" produces the file, so no PDF library is shipped. WhatsApp sharing sends a text summary plus a link that only the order's parties can open.

## PWA

`app/manifest.ts` + `public/sw.js`. The service worker caches hashed static assets only and falls back to `/offline` for navigations. It never caches HTML or API responses, because workspace pages contain private data and phones are often shared. Push handlers exist; subscription storage arrives with notifications.

## Integration seams (interfaces now, implementations later)

- `lib/payments/types.ts` — `PaymentProvider` (MTN MoMo, Orange Money). No implementation until verified provider docs and credentials exist.
- `lib/notifications/types.ts` — channel adapters (in-app, push, SMS, WhatsApp share links).

## Extending

New domains go in `src/features/<domain>/` with `schemas.ts`, `actions.ts`, `queries.ts`, `components/`, plus a migration and a SQL test file. Record significant choices in `docs/decisions/`.
