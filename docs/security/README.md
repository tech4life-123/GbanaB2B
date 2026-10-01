# Security notes

The threat model and control list live in [/SECURITY.md](../../SECURITY.md). This folder holds deeper write-ups as phases land (bid-privacy test plan in Phase 4, webhook verification in Phase 5, delivery-code design in Phase 6 — see [ADR 0016](../decisions/0016-delivery-code-disputes-and-frozen-escrow.md)).

## Verifying RLS locally

```bash
npm run test:db
```
Applies all migrations to a disposable PostgreSQL with a Supabase stub and runs `supabase/tests/*.sql`, switching between `anon`, `authenticated` (as different users) and `service_role` exactly as PostgREST does.

## Phase 8 audit (summary)

| Area | Result |
| --- | --- |
| RLS | Every public table has RLS on; the structural checks in `supabase/tests/80_phase8_audit.sql` also ran against the live project. |
| **Finding fixed** | `anon` and `authenticated` could read every column of active `businesses` rows (admin's internal verification note, owner user id, address, phone numbers, registration number) and `products.created_by`. Now column-level grants; the admin note is served by `business_verification_note()` (members/admin) and `admin_business_notes()` (admin). Queries name their columns (`src/lib/db/columns.ts`); `select *` on those tables is refused by design. |
| **Finding fixed** | `ai_take_quota` could be exceeded by simultaneous requests (check-then-insert race). Now serialized per user with an advisory lock. |
| Functions | Every SECURITY DEFINER function pins `search_path`; `anon` can execute none; `authenticated` access is explicit per function. |
| Headers | CSP (production) limits scripts, styles, images, media and connections to this site and the project's Supabase host; `frame-ancestors 'none'`; HSTS; nosniff; Referrer-Policy; Permissions-Policy. `script-src` still allows `'unsafe-inline'` for Next.js bootstrap scripts — moving to nonces is a later improvement. |
| Rate limits | Payment webhook: 120/min per caller and 10 bad signatures/min (per instance, best effort) before any database work; deep health check 30/min. A global limit needs a Vercel Firewall rule (runbook). |
| Concurrency | `npm run test:concurrency`: 21 assertions with parallel connections — stock confirmation, double escrow release, duplicate webhooks, same-version order transitions, AI quota. |
| Not covered here | Penetration test by a third party; real provider webhooks (adapters not live); signed-in accessibility pass; real-device testing on Liberian mobile networks. |
