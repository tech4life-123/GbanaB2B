# API surface

GbanaB2B uses **Server Actions** for mutations and Server Components for reads; there is no public REST API yet.

| Endpoint / action | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | none | Liveness; reports whether Supabase is configured (never values) |
| `sendOtp` / `verifyOtp` / `signOut` (`features/auth/actions.ts`) | none / session | Phone sign-in |
| `completeOnboarding` / `addRole` / `setDefaultRole` (`features/onboarding/actions.ts`) | session | Calls `complete_onboarding`, `request_role`, `set_default_role` |
| `updateSetting` (`features/admin/actions.ts`) | admin | Calls `update_platform_setting` |

Conventions: validate with Zod → authorise → call a database workflow function → return `ActionResult` (never throw raw errors to the client). Future payment webhooks will be Route Handlers under `/api/webhooks/<provider>` with signature verification and idempotency.
