# 0014 — Append-only double-entry ledger; escrow shares fixed at funding

**Status:** accepted (Phase 5)

**Context.** Escrow can't be `orders.status = 'paid'`. Every monetary event must be auditable and traceable.

**Decision.** Money lives in an append-only `ledger_entries` table: each event is an `entry_group` whose debits equal credits per currency, enforced by a deferred constraint trigger; update/delete/truncate are blocked. `escrow_accounts` fixes the fee, seller and carrier shares when the order is funded, so later fee-setting changes can't alter what an order pays out. Balances are derived (`ledger_balances` view). Corrections are new entries, never edits. USD and LRD are never summed; each payment stores the USD→LRD rate it saw.

**Consequences.** Reconciliation is a sum over entries. Mistakes need compensating entries.
