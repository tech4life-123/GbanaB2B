# 0013 — Sealed bids and database-enforced eligibility

**Status:** accepted (Phase 4)

**Context.** Carriers should not see each other's prices; sellers should not influence carrier choice; RFQs must not leak buyer or seller contact details.

**Decision.** Bid privacy is enforced in RLS (`carrier_can_see_rfq`, `is_rfq_buyer`), not in the UI: carriers read only their own bid, the buyer and admins read all, sellers read none and see only the resulting assignment. RFQs carry route and cargo only; contacts are snapshotted into the assignment at selection. Eligibility (verified carrier, coverage counties, verified vehicle capacity, not a party to the order) is computed in the database so every client gets the same answer. Bids close at `closes_at`, but the buyer may still book a live bid.

**Consequences.** Test suite 40 covers every role against every table. Adding negotiation or counter-offers later needs new policy work.
