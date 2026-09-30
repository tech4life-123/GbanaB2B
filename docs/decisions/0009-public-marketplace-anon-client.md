# 0009 — Public marketplace reads with a cookie-less anon client

**Status:** Accepted (Phase 2)

**Decision.** `/marketplace`, `/products/[slug]` and `/sellers/[slug]` query Supabase with a session-less publishable-key client (`lib/db/supabase/public.ts`), so RLS evaluates as `anon`.

**Why.** Public pages must show the same thing to everyone: a seller signed in must not see their own drafts on the public product page, and admins must not see suspended businesses there. Seller-side pages use the session client and see drafts via membership policies.
