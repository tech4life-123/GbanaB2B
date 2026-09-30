# 0015 — Success only from a verified provider message; isolated test provider

**Status:** accepted (Phase 5)

**Context.** No MTN/Orange API access yet, but the whole payment path must be built and tested. The spec forbids fake payment logic in the real financial pathway.

**Decision.** Core code depends on `PaymentProvider`. Payment success can only enter through `apply_provider_event`, executable by the service role alone, after the adapter verified authenticity. The test provider lives in its own module, signs events with a server-only secret, is labelled in the UI, and is controlled by an admin setting. MTN and Orange are placeholders that refuse to operate. A documented status query (`getStatus`) may also reconcile. Anything odd (unknown reference, wrong amount, late success) is parked and audited, never auto-applied.

**Consequences.** Switching to real providers is an adapter plus a setting; no core changes. The test provider must be turned off before launch.
