# Project status

_Last updated: 2026-09-29 (Supabase linked)_

## Current phase

**Phase 1 — Foundation: complete.** Stopped at the Phase 1 boundary as specified. Next: **Phase 2 — Marketplace.**

## Verification (all passing)

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ strict, 0 errors |
| `npm test` | ✅ 44 unit tests (phone normalisation, money, state machines, open-redirect guard, log redaction, protected paths, roles, schemas, nav config) |
| `npm run test:db` | ✅ 5 migrations apply cleanly on PostgreSQL 16; 50+ RLS/workflow assertions pass |
| Live Supabase | ✅ project `vdncwiptaheshyomgmsd` (eu-west-1): all 5 migrations applied; rolled-back smoke test confirmed profile trigger, onboarding, and that self-admin, direct role inserts, status edits, audit writes and setting changes are blocked |
| `npm run build` | ✅ production build (Next 16.3, Turbopack) |
| Visual check | ✅ landing, sign-in, design system, offline, 404 and the workspace shell reviewed at 1366px and 390px |

## Completed

**Application**
- Next.js 16 App Router + TypeScript strict + Tailwind v4, Vercel-ready; security headers; `proxy.ts` session refresh
- Brand: SVG shield-G logo (ribbon woven through, emerald escrow node), PWA icons generated from it
- Design system: tokens, 15+ components, `TradePath`/`StageTracker` signature motif, living reference at `/design-system`
- Public site: landing page (hero with illustrative waybill, trade path, audiences, carrier classes, escrow/trust, Liberia section, CTA), header with no-JS mobile menu, footer
- Auth: phone OTP sign-in (Liberian number normalisation, resend cooldown, rate-limit handling, open-redirect guard), onboarding (name + first role), add-role flow, sign-out, suspended-account page
- Workspaces for buyer / seller / carrier / admin: desktop sidebar + phone bottom tab bar, role switcher, per-role overviews with real setup checklists, honest "opens in phase N" pages for future sections, loading skeletons
- Admin foundation (real data via RLS): overview (accounts & role counts, recent audit, commission, integration status), users & roles table with pagination, platform settings with audited edit dialog, audit log
- PWA: manifest, installable icons, conservative service worker (static assets only, offline fallback, push handlers), online/offline banner
- Error boundary, not-found page, health endpoint, structured logger with PII redaction
- Interfaces only: `PaymentProvider` (MTN MoMo, Orange Money), notification channel adapters

**Database** (`supabase/migrations/`)
- `20260929000100_foundation.sql` — enums, `set_updated_at`, `prevent_mutation`, revoke-by-default privileges
- `20260929000200_identity_and_roles.sql` — `profiles`, `user_roles`, `has_role`/`is_admin`, auth.users triggers, RLS, column grants
- `20260929000300_audit_and_settings.sql` — append-only `audit_logs`, `write_audit_log`, `platform_settings` (+ seeded rules: 2.5% fee, OTP, bids, cancellation)
- `20260929000400_role_and_settings_workflows.sql` — `request_role`, `set_default_role`, `complete_onboarding`, `grant_role`, `revoke_role`, `update_platform_setting`, `bootstrap_admin`
- `20260929000500_advisor_hardening.sql` — FK indexes, single SELECT policy per table, closes client access to Supabase's `rls_auto_enable()`

**Documentation:** README, ARCHITECTURE, DATABASE, SECURITY, ROADMAP, this file, `docs/` (database conventions & domain model, design system, payments, order/escrow workflow, API, 6 ADRs). CI workflow in `.github/workflows/ci.yml`.

## Known limitations

- **Supabase linked, SMS not yet verified.** Database is live. Phone sign-in needs Supabase Auth → Phone enabled with an SMS provider; end-to-end SMS sign-in has not been tested yet.
- **Not deployed.** No Vercel project exists yet; env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) must be added when it is created.
- Supabase advisor still lists the authenticated-callable SECURITY DEFINER functions (`request_role`, `grant_role`, …). This is intentional: each validates the caller inside the function and is covered by tests.
- `src/lib/db/types.ts` is hand-written; regenerate with the Supabase CLI once linked.
- Admin role grant/revoke exists in the database but has no UI yet (planned alongside Phase 4 verification tooling).
- Push notification subscription storage and sending are not built (Phase 3+ with notifications).
- No dark mode (deliberate for Phase 1; tokens make it addable).
- Automated accessibility audit (axe) and real-device 3G testing are scheduled for Phase 8; Phase 1 relied on semantic HTML, labelled controls, focus styles, contrast-checked tokens and reduced-motion support.

## Unresolved decisions

1. Supabase project region and plan; SMS provider for +231 numbers (Twilio/Vonage/MessageBird/local aggregator) and cost controls.
2. Payment provider onboarding: merchant accounts and API documentation from Lonestar Cell MTN and Orange Liberia.
3. Fee rounding rule (to seller or platform) — ADR required before Phase 5.
4. Business verification requirements (registration documents, TIN) — needed to design Phase 2 `businesses`.
5. Whether one business can have multiple sellers/members at launch (schema supports it; UX to confirm).
6. Production domain name.

## Next phase — Phase 2: Marketplace

Businesses & members, categories, products with images (private-by-default Storage, public listing images), specifications, MOQ, reusable price tiers, logistics attributes, search & filters (Postgres full-text), product and seller pages, seller listing management — with migrations, RLS tests and docs.
