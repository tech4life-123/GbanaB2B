# GbanaB2B — Wholesale & Freight Exchange

A B2B wholesale marketplace, freight exchange and escrow-payment platform, built first for Liberia.

```
DISCOVER → ORDER → REQUEST FREIGHT → SEALED BIDS → SELECT CARRIER → PROFORMA → PAY → ESCROW → DELIVER → CONFIRM → RELEASE
```

> **Status:** Phase 1 (Foundation) complete. See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [ROADMAP.md](ROADMAP.md).

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, self-hosted Archivo + JetBrains Mono, lucide icons |
| Data | Supabase — PostgreSQL, Auth (phone OTP), Storage, RLS |
| Validation | Zod 4 on every server boundary |
| Tests | Vitest (unit) + SQL suite against real PostgreSQL (migrations + RLS) |
| Hosting | Vercel-compatible; PWA with a conservative service worker |

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in Supabase URL + publishable key
npm run dev                     # http://localhost:3000
```

The app runs **without** Supabase configured: public pages work, and sign-in shows a clear "not connected" notice.

### Connecting Supabase

1. Create a Supabase project. Enable **Phone** auth and configure an SMS provider (Auth → Providers → Phone).
2. Apply the migrations in `supabase/migrations/` in order — `supabase db push` with the CLI, or paste each file into the SQL editor.
3. Put the project URL and publishable key in `.env.local` (and in Vercel project env vars).
4. Sign in once with your phone, then promote yourself to the first admin from the SQL editor:
   ```sql
   select public.bootstrap_admin('+2317XXXXXXXX');
   ```
   This function is not callable from the app. Every later admin grant goes through `grant_role` and is audited.
5. Optional: regenerate types with `supabase gen types typescript --linked > src/lib/db/types.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Applies all migrations to a throwaway PostgreSQL and runs the RLS/workflow suite (needs PostgreSQL 15+ binaries) |
| `npm run check` | lint + typecheck + test + build |
| `npm run icons` | Regenerates PWA icons from `public/icons/mark.svg` |

## Project layout

```
src/
  app/                 routes: (site) public · (auth) sign-in/onboarding · (workspace) buyer/seller/carrier/admin
  components/          ui/ design-system primitives · brand/ logo + trade path · site/ · pwa/
  features/            domain modules: auth, onboarding, workspace, admin (+ marketplace, orders, logistics, payments… as phases land)
  lib/                 auth/ db/ payments/ notifications/ money/ security/ validation/ logging/ state-machine
  config/              env validation (public + server-only), site constants
  proxy.ts             session refresh + optimistic auth redirect (Next 16's replacement for middleware)
supabase/
  migrations/          the database source of truth
  tests/               Supabase stub + SQL test suites
docs/                  architecture, database, security, payments, workflows, decisions (ADRs)
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design and boundaries
- [DATABASE.md](DATABASE.md) — schema, conventions, RLS matrix
- [SECURITY.md](SECURITY.md) — threat model and controls
- [ROADMAP.md](ROADMAP.md) — the eight build phases
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — what exists today
- [docs/](docs/) — deeper notes and architecture decision records

Fonts are licensed under the SIL Open Font License (see `src/fonts/`).
