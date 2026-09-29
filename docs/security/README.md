# Security notes

The threat model and control list live in [/SECURITY.md](../../SECURITY.md). This folder holds deeper write-ups as phases land (bid-privacy test plan in Phase 4, webhook verification in Phase 5, delivery-code design in Phase 6).

## Verifying RLS locally

```bash
npm run test:db
```
Applies all migrations to a disposable PostgreSQL with a Supabase stub and runs `supabase/tests/*.sql`, switching between `anon`, `authenticated` (as different users) and `service_role` exactly as PostgREST does.
