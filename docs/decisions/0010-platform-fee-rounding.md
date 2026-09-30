# 0010 — Platform fee: seller-side, rounded half-up

**Status:** Accepted (Phase 3). The rounding rule is provisional until the Phase 5 ledger ADR confirms it.

**Decision.** The platform fee is `round_half_up(subtotal_minor × fee_bps / 10 000)`, computed in integer minor units by `public.fee_for()` (mirrored by `feeFor()` in `lib/orders/cart.ts`). It is charged on the goods subtotal only, never on freight. It is deducted from the seller's proceeds rather than added to the buyer's total. The bps value is snapshotted on each order, so later setting changes don't touch existing orders.

**Why.**
- Half-up is what people expect when checking a bill by hand. At 250 bps the most it can move a fee is half a cent.
- A seller-side fee keeps the buyer's total equal to the prices on the listing, which is simpler to trust.
- Integer arithmetic with an explicit rule means the database, the UI and the future ledger always agree.

**Consequences.** Phase 5 double-entry: seller entitlement = subtotal − fee; platform revenue = fee; carrier entitlement = accepted bid. The cent-level remainder is always resolved by this rule and never split across parties.
