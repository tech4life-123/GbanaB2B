# Delivery, disputes, reviews and trust (Phase 6)

Migration: `supabase/migrations/20261003000100_delivery_and_trust.sql`. Tests: `supabase/tests/60_phase6_delivery_trust.sql` (181 assertions).

## Tables

| Table | Purpose | Client access |
| --- | --- | --- |
| `order_deliveries` | One row per order once the carrier collects: `picked_up_at`, `arrived_at`, `completed_at`, `confirmation_method` (`buyer_code`, `buyer`, `auto`, `admin`) | read (parties, assigned carrier, admin) |
| `delivery_events` | Append-only tracking: `picked_up`, `checkpoint`, `arrived`, `delivery_failed`, `delivered`. Optional lat/lng rounded to 4 decimals (~11 m) | read |
| `delivery_codes` | The 6-digit code, attempts, `locked` | **buyer of the order only** (RLS). Admins and sellers cannot read it |
| `disputes` | `dispute_number`, kind, status, `prior_order_status` (restored on withdraw), requested/decided refund, fault, decision note | read by parties and admin |
| `dispute_messages` | Conversation thread (append-only) | read |
| `dispute_evidence` | Registered files in the private `dispute-evidence` bucket (append-only, 12-file cap) | read |
| `reviews` | One per order per subject (seller or carrier), immutable, one reply, admin can hide | public columns only (no reviewer id, no order id); hidden rows invisible |
| `trust_stats` | Public aggregates: completed orders, cancellations by subject, disputes upheld, review count, rating sum | public read |

`escrow_accounts.refunded_minor` records a partial refund.

## Workflows (all SECURITY DEFINER, `search_path = ''`, explicit grants)

Carrier: `carrier_mark_picked_up`, `carrier_post_checkpoint`, `carrier_mark_arrived`, `carrier_report_delivery_failed`, `carrier_confirm_delivery` (returns `confirmed` / `wrong_code` / `locked` instead of raising, so a wrong attempt is **counted**).
Buyer: `buyer_confirm_delivery`, `regenerate_delivery_code`, `cancel_unpaid_order`.
Parties: `open_dispute`, `add_dispute_message`, `register_dispute_evidence`, `withdraw_dispute`.
Admin: `admin_start_dispute_review`, `admin_resolve_dispute`, `admin_hide_review`, `admin_list_reviews`, `admin_release_escrow` / `admin_refund_escrow` (now refuse while a dispute is live).
Buyer reviews: `submit_review`, `order_review_status`. Subject: `reply_to_review`.
Service role only: `sweep_overdue_orders()`.

All money moves through internal helpers that write the balanced ledger: `settle_escrow`, `refund_escrow_full`, `refund_escrow_partial`, `cancel_unpaid_internal` (not executable by clients).

## Money rules

- Escrow total = goods subtotal + freight; shares are fixed when funded.
- Partial refund funded by the **seller**: the platform fee is recomputed on (goods − refund), so the fee shrinks with the sale. Funded by the **carrier**: taken from freight. Max one refund per order.
- The test covers a goods value of 25 000 with a 5 000 seller-funded refund: fee 475, seller 18 525, buyer refunded 5 000, carrier unchanged.

## Settings (`platform_settings`)

`delivery.code_max_attempts` 5, `delivery.auto_confirm_hours` 72, `delivery.checkpoint_min_seconds` 120, `orders.payment_window_hours` 48, `disputes.max_evidence_files` 12, `reviews.window_days` 30.

## Known design notes

- Carriers cannot read `orders` (by design); they see their assignment, delivery, events and the freight request. The UI uses the freight request number as their reference.
- Reviews show `reviewer_label` (the buyer's business or name) — nothing else identifies the reviewer.
- Evidence cannot be deleted by anyone once registered.
