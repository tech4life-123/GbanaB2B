# Security

Security is a product requirement. This document is the threat model and the control list; update it with every phase.

## Assets

1. Money in escrow and the ledger that describes it
2. Identity: phone numbers, national IDs, driver licences, vehicle documents
3. Sealed freight bids (commercially sensitive)
4. Administrative powers (verification, refunds, settings)
5. Audit history

## Threats & controls

| Threat | Control | Status |
| --- | --- | --- |
| User grants themselves admin / changes status | No INSERT/UPDATE on `user_roles`; column grants on `profiles`; `request_role` rejects admin | ✅ tested |
| Role claimed by client | Roles read from DB per request (`getViewer`); RLS uses `has_role()` | ✅ |
| Suspended user keeps acting | `has_role()` requires `profiles.status = 'active'`; `requireRole` redirects | ✅ tested |
| Admin data leak | Admin reads go through RLS admin policies; admin routes 404 for non-admins | ✅ |
| Audit tampering | Trigger blocks UPDATE/DELETE/TRUNCATE for every role; service_role has no update/delete grant | ✅ tested |
| Settings abuse | Admin-only function; type-locked; numeric bounds; audited old→new | ✅ tested |
| Forgotten grants | Default privileges revoked for client roles; PUBLIC execute revoked globally | ✅ tested |
| Open redirect after sign-in | `safeNextPath` allows only same-origin paths | ✅ tested |
| Secret exposure | `server-only` modules for secrets; env validated with Zod; only `NEXT_PUBLIC_*` in bundle | ✅ |
| OTP brute force / SMS pumping | Supabase Auth rate limits (configure in dashboard); generic error messages | ⚙️ configure per project |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, HSTS, referrer policy | ✅ |
| Private pages cached on shared phones | Service worker never caches HTML/API | ✅ |
| PII in logs | Logger redacts phone/otp/token/secret keys | ✅ tested |
| Competitor sees bids | RLS own-rows-only + tests via API, nested relations, Realtime | 🔜 Phase 4 |
| Fake payment success | Provider interface: success only from verified webhook/status query; idempotency keys | 🔜 Phase 5 |
| Double escrow release | Transactional, idempotent release function + state machine | 🔜 Phase 5/6 |
| Delivery code guessing | Hashed, expiring, single-use, attempt-limited codes | 🔜 Phase 6 |
| Document exposure | Private storage buckets; signed URLs for admins only | 🔜 Phase 4 |

## Operational procedures

**First admin:** after the person signs in once, run `select public.bootstrap_admin('+231…');` in the Supabase SQL editor. This is recorded in the audit log. The function is not executable by `anon` or `authenticated`.

**Key handling:** the Supabase secret/service-role key lives only in server environment variables (Vercel, encrypted). Rotate on staff changes. Never paste it into client code, issues or chat.

**Supabase Auth settings to review:** phone provider + SMS rate limits, OTP expiry (≤ 10 min), OTP length 6, disable email sign-ups if unused, enable leaked-password protection if passwords are ever enabled.

## AI boundary

AI features (Phase 7) may summarise and recommend. They must never approve payments, release escrow, approve refunds, verify identities or drivers, or alter financial records or audit logs.

## Reporting

Security issues: contact the maintainers privately. Do not open public issues for vulnerabilities.
