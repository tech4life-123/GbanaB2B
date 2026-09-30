# Payments

## Status

Phase 5 is built: provider interface, a clearly labelled **test provider** (`providers/sandbox.ts`, no real money, signed webhooks), refusing placeholders for MTN and Orange (`providers/unconfigured.ts`), the webhook route `/api/webhooks/payments/[provider]`, escrow, the ledger, payouts, refunds and exchange rates. **MTN and Orange are NOT connected** — see [adding-a-provider.md](adding-a-provider.md). Schema: [../database/payments.md](../database/payments.md).

## Principles

- Provider-agnostic core: escrow and ledger code depends on `PaymentProvider`, never on MTN or Orange directly.
- Adapters (`mtn_momo_lr`, `orange_money_lr`) are written only from official, verified provider documentation with real sandbox credentials.
- A development/sandbox provider may exist, in its own module, selectable only when `NODE_ENV !== "production"` and clearly labelled in the UI.
- Success comes only from a verified webhook (signature/secret checked) or a documented status query — never from a browser redirect.
- Every request has an idempotency key; retries reuse it; duplicate/late webhooks are no-ops.
- Amounts: integer minor units + currency. LRD/USD conversions store the rate used.
- Every monetary event writes append-only ledger entries traceable order → payment → escrow → ledger → payout.

## Open items before real money moves

- Obtain merchant/API access and documentation from Lonestar Cell MTN (MoMo) and Orange Liberia.
- Confirm webhook authentication method, settlement timing, fees, and reversal/refund support per provider.
- Decide rounding rule for platform fees (ADR).
