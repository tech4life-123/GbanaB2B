# 0002 — Phone-number identity with SMS OTP

**Status:** Accepted (Phase 1)

**Decision.** Supabase Auth phone OTP is the primary sign-in. Numbers normalised to E.164 (`lib/validation/phone.ts`); Liberian mobiles validated as +231 + 9 digits starting 5/7/8. Personal data lives in `profiles`, separate from credentials. We do not infer the mobile operator from the prefix.

**Consequences.** Requires an SMS provider configured in Supabase and SMS rate limits tuned against SMS-pumping fraud. Email/password can be added later without schema change.
