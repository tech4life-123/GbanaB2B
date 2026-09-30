# 0016 — Buyer-held delivery code, frozen escrow during disputes

**Status:** accepted (Phase 6)

**Context.** Escrow must release only when the buyer has really received the goods, without an admin in the loop for every order, and without letting anyone be paid while a claim is open.

**Decision.**
- A random 6-digit code is created at pickup and readable only by the buyer. The carrier enters it; the database counts attempts and locks after 5 (`carrier_confirm_delivery` returns a result instead of raising, so counts persist). The code is stored readable because the buyer must be able to show it again; it is protected by RLS, the attempt limit, regeneration and by being useless once the order is settled.
- Release happens in one place, `settle_escrow`, for every path (code, buyer button, 72-hour sweep, admin).
- An open dispute freezes every release/refund path; only `admin_resolve_dispute` (or the opener withdrawing) can move the order on. Partial refunds are funded by the at-fault share.
- Evidence lives in a private bucket, uploaded directly by the browser and registered by a database function that re-checks the path, type and file count.
- Reviews are immutable, one per order per subject, replies once; admins may hide (audited) and hiding reverses the aggregate.
- Housekeeping runs from a secret-protected cron route calling one service-role function.

**Consequences.** Carriers cannot see orders, only their assignment. Silence eventually pays out (72 h), which favours sellers/carriers; the window is a setting. Trust numbers are simple counters, not a score.
