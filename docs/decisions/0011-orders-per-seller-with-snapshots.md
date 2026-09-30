# 0011 — One order per seller and currency; buyers are people; everything snapshotted

**Status:** Accepted (Phase 3)

**Decision.**
1. Checkout turns a mixed cart into one order per (seller business, currency).
2. The buyer on an order is a **profile** (a person). The business they buy for is an optional name captured at checkout into `buyer_snapshot`, not a `businesses` row.
3. Orders copy everything they depend on: item title, unit, price, tier and weight; the delivery address; buyer and seller details; the fee bps. Proforma invoices copy the order again and are immutable.

**Why.**
- Each seller confirms, packs and gets paid independently, and each needs its own freight job and escrow. One order per seller keeps those lifecycles separate. Currencies are never summed.
- Most small Liberian retailers buy as themselves. Making them register a business before their first order adds friction for little benefit. `businesses` stays reserved for sellers and verification (ADR 0007).
- Listings, addresses and business profiles change. An order and its invoice must keep showing what was agreed, so they never join back to live rows for display.

**Consequences.** Buyer business accounts (team purchasing, credit) can be added later as a nullable `buyer_business_id` without changing existing orders.
