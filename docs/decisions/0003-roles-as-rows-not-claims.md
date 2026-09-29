# 0003 — Roles as database rows, mutated only by audited functions

**Status:** Accepted (Phase 1)

**Decision.** `user_roles` (many per user) instead of a single role column or JWT custom claims. Clients have SELECT only; changes go through `request_role` (buyer/seller/carrier), `grant_role`/`revoke_role` (admin) and `bootstrap_admin` (SQL editor only). `has_role()` also requires an active account.

**Alternatives.** JWT custom claims hook: faster RLS but stale until token refresh — unacceptable for suspensions and revocations.

**Consequences.** One indexed lookup per policy evaluation (cached per statement via `(select …)`). Revocation is immediate.
