# 0018 — Column-level grants for publicly readable tables

**Status:** accepted (Phase 8)

**Context.** RLS decides which rows a role sees, not which columns. `businesses` and `products` had table-wide SELECT for `anon` and `authenticated`, so any visible row exposed every column, including internal admin notes and contact details.

**Decision.**
- `anon` gets an explicit column list matching what public pages render. `authenticated` gets everything except the admin's internal verification note.
- The note is read through two narrow SECURITY DEFINER functions (own business / admin).
- Application queries on these tables name their columns (`src/lib/db/columns.ts`); `select *` fails by design, so a new private column can't leak by accident.
- A structural test (`80_phase8_audit.sql`) pins the invariants: RLS on, `search_path` pinned, no anon function execution, covering FK indexes, and the specific columns above.

**Consequences.** Adding a column to these tables means choosing who may read it. Payment-time access to a seller's contact phone still works because it is part of the `authenticated` list; if that should be narrower, move it behind a function.
