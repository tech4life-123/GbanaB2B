# 0005 — Revoke-by-default privileges

**Status:** Accepted (Phase 1)

**Context.** Supabase grants client roles broad default privileges in `public`, and PostgreSQL grants EXECUTE on new functions to PUBLIC. The Phase 1 SQL tests caught an internal function (`write_audit_log`) that was callable by signed-in users because of the global PUBLIC default.

**Decision.** Migration 0001 revokes table/sequence/function defaults from `anon`/`authenticated` per-schema and revokes PUBLIC's function EXECUTE globally. Every object grants explicitly.

**Consequences.** Forgotten grants fail closed (feature doesn't work) instead of open (data exposed). New migrations must include grants and tests.
