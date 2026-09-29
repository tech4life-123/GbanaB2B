# 0001 — Modular monolith on Next.js + Supabase

**Status:** Accepted (Phase 1)

**Context.** Small team, greenfield, Liberia-first, Vercel hosting, spec mandates Next.js App Router and Supabase.

**Decision.** One Next.js app with domain modules under `src/features/*`; business-critical rules enforced in PostgreSQL (RLS + SECURITY DEFINER functions) rather than only in TypeScript.

**Consequences.** Fast iteration and one deploy. The database is the security boundary, so every rule needs SQL tests (`npm run test:db`). Heavy background work (reconciliation, payouts) will use Supabase scheduled functions or Vercel cron calling idempotent endpoints.
