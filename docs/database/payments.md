# Financial engine (Phase 5)

Migration `supabase/migrations/20261002000100_payments.sql` · tests `supabase/tests/50_phase5_payments.sql` (109 assertions).

**Trace:** order → payment_intent → payment_transaction → provider_event → escrow_account → ledger_entries → payout / refund.

| Table | Purpose | Visible to |
| --- | --- | --- |
| `payment_intents` | One live intent per order; amount = order total; remembers the USD→LRD rate seen. | Buyer, admin |
| `payment_transactions` | Each attempt with a provider; unique idempotency key. Holds the payer's phone. | Buyer, admin (never the seller) |
| `provider_events` | Every verified provider message once (`unique(provider, event_id)`); only `outcome` can change. | Admin |
| `escrow_accounts` | One per order; fee / seller / carrier shares fixed at funding. | Parties of the order, admin |
| `ledger_entries` | Append-only double-entry ledger; each `entry_group` balances per currency (deferred constraint trigger). | Admin |
| `payouts` | Seller and carrier shares created on release. | Recipient, admin |
| `refunds` | Full refund of escrow to the paying number. | Buyer, admin |
| `exchange_rates` | Append-only rate history. | Everyone signed in |

## Money flow (ledger accounts)
- Funded: Dr `provider_clearing` / Cr `escrow` (total)
- Released: Dr `escrow` / Cr `platform_fees`, `seller_payable`, `carrier_payable`
- Payout started: Dr `*_payable` / Cr `payouts_clearing`; paid: Dr `payouts_clearing` / Cr `provider_clearing`; failed: reversed
- Refund: Dr `escrow` / Cr `refunds_payable`; paid: Dr `refunds_payable` / Cr `provider_clearing`
- Success that no order can take: Dr `provider_clearing` / Cr `unapplied_funds`, flagged to admins

Gross paid = product subtotal + freight. Fee = `commerce.platform_fee_bps` on the subtotal, taken from the seller (ADR 0010). Carrier gets the accepted freight bid.

## Functions
Buyer: `start_payment`. Server (service role only): `record_payment_attempt`, `apply_provider_event`. Admin: `admin_release_escrow`, `admin_refund_escrow`, `admin_mark_refund`, `admin_retry_refund`, `admin_begin_payout`, `admin_finish_payout`, `set_exchange_rate`. All audited where money or rates change; all idempotent.

## Webhook outcomes
`applied`, `applied_late`, `already_applied`, `duplicate_event`, `ignored_stale`, `conflict_already_succeeded`, `unknown_reference`, `amount_mismatch`, `orphan_success`. The last four are audited as `payment.event_needs_review`.

## Known limits
- Partial refunds and dispute-driven refunds arrive with Phase 6.
- Release is an admin decision until the delivery code (Phase 6) calls the same path.
- Cancelling an order that is already `awaiting_payment` isn't allowed yet (stock stays reserved); Phase 6 adds expiry.
