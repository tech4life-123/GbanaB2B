# 0004 — Business rules in `platform_settings`

**Status:** Accepted (Phase 1)

**Decision.** Fee (bps), cancellation window, bid expiry, delivery-code lifetime/attempts and sign-in attempts are rows in `platform_settings`, typed by their initial JSON value and bounded by `min_value`/`max_value`. Only `update_platform_setting` (admin, audited old→new) changes them. Transactions snapshot the values they used.

**Consequences.** No magic numbers in code. Changing the fee never alters existing orders.
