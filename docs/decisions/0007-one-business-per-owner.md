# 0007 — One owned business per person at launch

**Status:** Accepted (Phase 2)

**Context.** The schema supports many businesses and many members per business, but invitations, team roles and multi-business switching need UX that isn't built yet. Unlimited business creation also invites spam listings before verification tooling matures.

**Decision.** `create_business()` refuses if the caller already owns a business. Membership (owner/manager/staff) is modelled now; only owners exist until invitations ship.

**Consequences.** Lifting the limit is a one-line change in `create_business()` plus a business switcher in the seller workspace. No data migration needed.
