# Order & escrow lifecycle (target design)

Phase 3 implements `PENDING_SELLER → CONFIRMED → FULFILLING → READY_FOR_FREIGHT` and `CANCELLED` (see [docs/database/commerce.md](../database/commerce.md)); Phases 4–6 add the rest.

## Order states

```
DRAFT → PENDING_SELLER → CONFIRMED → FULFILLING → READY_FOR_FREIGHT → FREIGHT_REQUESTED
      → CARRIER_SELECTED → AWAITING_PAYMENT → PAID_ESCROW → IN_TRANSIT → DELIVERED
      → AWAITING_CONFIRMATION → COMPLETED
```

Side exits: `CANCELLED` (before `PAID_ESCROW`, within the cancellation window or by seller rejection), `DISPUTED` (from `IN_TRANSIT`/`DELIVERED`/`AWAITING_CONFIRMATION`; escrow frozen), `REFUNDED` / `PARTIALLY_REFUNDED` (admin resolution only).

Rules:
- Transitions happen only inside server functions, validated by `lib/state-machine.ts` and mirrored in the database.
- Every transition appends to `order_status_history` with actor and reason.
- Prices, fee bps, freight amount and exchange rate are snapshotted at `CONFIRMED` / `CARRIER_SELECTED` and never recalculated.

## Money

```
Gross paid         = product subtotal + accepted freight bid
Platform fee       = product subtotal × platform_fee_bps / 10 000   (setting: commerce.platform_fee_bps, default 250)
Seller net         = product subtotal − platform fee
Carrier net        = accepted freight bid
```
Rounding: integer minor units, half-up (ADR 0010).

## Escrow release

1. Buyer pays → provider webhook verified → `payment_transactions.SUCCEEDED` → escrow `FUNDED` + ledger entries.
2. Delivery code generated for the buyer: random, hashed at rest, expires (`delivery.otp_expiry_minutes`), limited attempts (`delivery.otp_max_attempts`), single-use.
3. Driver enters the code → server verifies → one transaction moves escrow to `RELEASED` and writes seller/carrier entitlements. Idempotent: a second call is a no-op.
4. Payouts initiated per entitlement; failures retried with the same idempotency key.

## Sealed bidding

Carriers see only RFQs they are eligible for (verified, capacity ≥ cargo, route coverage) and only their own bids. Buyers see all bids on their own RFQs. Tests must prove Carrier A cannot see Carrier B's bid via direct query, nested select, Realtime or predictable URLs.
