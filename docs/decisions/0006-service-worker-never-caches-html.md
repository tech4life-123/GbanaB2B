# 0006 — Service worker never caches pages or API responses

**Status:** Accepted (Phase 1)

**Decision.** Cache only hashed static assets and icons; navigations are network-only with an `/offline` fallback.

**Why.** Workspace pages include orders, balances and personal data, and phones are frequently shared. Stale financial data is also dangerous. Offline *shell* support is sufficient; operations that need the server say so.
