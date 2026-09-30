# Domain model (planned)

Target relational model, phase by phase. Designed around the business, not the current UI. Tables marked ✅ exist.

## Identity (Phase 1–2)
- ✅ `profiles`, ✅ `user_roles`
- ✅ `businesses` (legal name, trading name, type: importer/wholesaler/retailer/fleet, registration no., county, verification status)
- ✅ `business_members` (business ↔ profile, member role: owner/manager/staff)
- `addresses` (owner business, label, county, town, landmark, geo point, is_default) — built in Phase 3 with delivery destinations

## Commerce (Phase 2)
- ✅ `product_categories` (tree-ready)
- ✅ `products` (seller business, title, description, SKU, unit, MOQ, qty available, packaging, handling, fragile, stackable, origin country, status)
- ✅ `product_images` (storage path, order) · ✅ `product_specifications` (key/value) · `product_variants` (deferred — separate listings per size for now)
- ✅ `product_price_tiers` (min_qty, max_qty nullable, unit_price_minor; currency on product) — contiguity enforced by `save_product_pricing`
- ✅ Logistics attributes on product: `unit_weight_g`, `unit_volume_cm3`, dimensions, fragile, stacking

## Orders (Phase 3)
- `orders` (buyer business, seller business, status enum, currency, subtotal_minor, fee_bps snapshot, exchange_rate snapshot, delivery address snapshot, version for optimistic concurrency)
- `order_items` (product snapshot: title, unit, unit_price_minor, qty, weight)
- `order_status_history` (append-only)
- `proforma_invoices` (number sequence, immutable JSON snapshot, issued_at)

## Freight (Phase 4)
- `driver_profiles`, `vehicle_profiles` (payload_kg, class small/medium/large derived + numeric), `coverage_routes`
- `verification_documents` (private storage path, doc type) · `verification_records` (PENDING → UNDER_REVIEW → VERIFIED/REJECTED/SUSPENDED, reviewer, reason)
- `freight_rfqs` (order, pickup, destination, cargo weight/volume/packages, window, expires_at)
- `driver_bids` (rfq, carrier, amount_minor, eta, status SUBMITTED/WITHDRAWN/ACCEPTED/REJECTED/EXPIRED; unique (rfq, carrier)) — **RLS: carrier sees only own rows; buyer sees bids on own RFQ; no carrier-facing aggregate views**
- `carrier_assignments` (rfq, accepted bid, snapshot amount)

## Money (Phase 5)
- `payment_transactions` (provider, idempotency key unique, status, provider refs, raw payloads)
- `escrow_accounts` (order, state PENDING/FUNDED/RELEASING/RELEASED/REFUNDED/PARTIALLY_REFUNDED/FROZEN)
- `ledger_entries` (append-only double-entry: account, debit/credit minor, currency, entry group id)
- `payout_transactions`, `refund_transactions`, `platform_fees`, `exchange_rates` (effective_from, set_by)

## Delivery & trust (Phase 6)
- `delivery_status_events`, `delivery_tracking_events` (throttled points)
- `delivery_confirmations` (order, code_hash, expires_at, attempts, used_at)
- `disputes`, `dispute_evidence` (private storage), `reviews`, `ratings`

## Communication
- `notifications`, `notification_preferences`, `push_subscriptions`, `messages`

## Administration
- ✅ `platform_settings`, ✅ `audit_logs`, `admin_actions`
