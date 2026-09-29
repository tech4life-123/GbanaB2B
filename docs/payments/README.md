# Payments

## Status

Phase 1 defines the contract only: `src/lib/payments/types.ts`. **No payment is processed, simulated or displayed as successful anywhere in the app.**

## Principles

- Provider-agnostic core: escrow and ledger code depends on `PaymentProvider`, never on MTN or Orange directly.
- Adapters (`mtn_momo_lr`, `orange_money_lr`) are written only from official, verified provider documentation with real sandbox credentials.
- A development/sandbox provider may exist, in its own module, selectable only when `NODE_ENV !== "production"` and clearly labelled in the UI.
- Success comes only from a verified webhook (signature/secret checked) or a documented status query — never from a browser redirect.
- Every request has an idempotency key; retries reuse it; duplicate/late webhooks are no-ops.
- Amounts: integer minor units + currency. LRD/USD conversions store the rate used.
- Every monetary event writes append-only ledger entries traceable order → payment → escrow → ledger → payout.

## Open items before Phase 5

- Obtain merchant/API access and documentation from Lonestar Cell MTN (MoMo) and Orange Liberia.
- Confirm webhook authentication method, settlement timing, fees, and reversal/refund support per provider.
- Decide rounding rule for platform fees (ADR).
