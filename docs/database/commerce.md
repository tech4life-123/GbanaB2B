# Commerce schema (Phase 3)

Migrations: `20260930000400_commerce.sql`, `20260930000500_commerce_indexes.sql`. Tests: `supabase/tests/30_phase3_commerce.sql` (73 assertions).

## Tables

| Table | Purpose | Client access |
| --- | --- | --- |
| `addresses` | A buyer's delivery destinations (label, contact, E.164 phone, county, town, street, landmark, optional lat/lng). Max 20; exactly one default. | Own rows only (`addresses_own`). Insert/update limited by column grants. |
| `cart_items` | Server-side procurement cart: one row per (profile, product). Survives flaky connections and follows the user across devices. Max `commerce.max_cart_lines`. | Own rows; insert needs the buyer role. Only `quantity` is updatable, so a line can't be swapped to another product. |
| `orders` | One seller and one currency per order. Money in integer minor units, with the fee bps, fee, buyer, seller and address snapshots taken at placement. `version` for optimistic concurrency. | Select only: the buyer, members of the selling business, admins. **No client insert/update.** |
| `order_items` | Immutable line snapshots: title, unit, SKU, packaging, qty, unit price, line total (checked = price × qty), unit weight, the tier range used. | Select via `can_view_order()`. Update/delete blocked by trigger for every role. |
| `order_status_history` | Append-only: from → to, actor, actor role, note. | Select via `can_view_order()`. |
| `proforma_invoices` | Immutable JSON snapshot of the order at confirmation, numbered `PI-YYYY-NNNNNN`, with revision (Phase 4 adds a revision when freight is booked). | Select via `can_view_order()`. |

Order numbers: `GB-YYMM-NNNNNN` from `order_number_seq` (not callable by clients).

## Workflows

**`place_orders(address, business_name?, note?) → uuid[]`**. Checkout. Requires the buyer role and one of the caller's own addresses. It locks the products in the cart, then validates every line: active product in an active business, qty ≥ MOQ, qty ≤ available, not the buyer's own business, and a tier price exists. If any line fails, nothing is created. It then creates one order per (seller, currency), re-pricing every line from the current tiers. Next it writes the snapshots, the items and the first history row, and finally clears the cart.

**`transition_order(order, to, note?, expected_version?)`** is the only way an order changes status.

| From → to | Who | Notes |
| --- | --- | --- |
| pending_seller → confirmed | seller | Reserves stock (fails if not enough) and issues the proforma. |
| pending_seller → cancelled | buyer, seller, admin | Seller/admin must give a reason. |
| confirmed → fulfilling | seller | |
| confirmed → cancelled | buyer (within `commerce.order_cancellation_window_minutes` of placement), seller, admin | Restores reserved stock. |
| fulfilling → ready_for_freight | seller | Phase 4 continues from here. |
| fulfilling / ready_for_freight → cancelled | seller, admin | Reason required; restores stock. |

Actor precedence: a member of the selling business acts as the **seller**, then the order's buyer acts as the **buyer**, then an admin acts as **admin**. Admin transitions are written to `audit_logs` (`order.admin_transition`). A stale `expected_version` fails with SQLSTATE 40001, so two people can't act on the same page state.

The TypeScript mirror is `src/lib/orders/state.ts`. `tests/unit/orders.test.ts` checks that it allows exactly the same moves.

## Money

- The buyer's total is `subtotal + freight`. Freight is null until Phase 4.
- The platform fee is `fee_for(subtotal, commerce.platform_fee_bps)`, rounded half-up (ADR 0010). It is deducted from the seller's proceeds and **not** added to the buyer's total.
- USD and LRD are never summed: the cart splits orders by currency.

## Stock

Placing an order does **not** reserve stock. The seller hasn't agreed yet, and holding stock for unconfirmed orders would let one buyer lock out everyone else. Confirmation reserves it atomically (`quantity_available >= qty` in the UPDATE), so two orders can't both take the last units. Cancelling a confirmed order puts the stock back.
