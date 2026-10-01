# Operations runbook

For whoever is on call. Keep it short; update it when something surprises you.

## Where things live
| Thing | Where |
| --- | --- |
| App | Vercel project `gbana-b2-b` (auto-deploys `main` from GitHub `tech4life-123/GbanaB2B`) |
| Database, auth, storage | Supabase project `vdncwiptaheshyomgmsd` |
| Logs | Vercel → Project → Logs (one JSON object per line: `ts`, `level`, `event`, …) |
| Audit trail | Admin → Audit log (append-only, in the database) |
| Health | `GET /api/health` (liveness) · `GET /api/health?deep=1` (also checks the database; 503 when it can't answer) |

## Uptime monitor
Point any free monitor (UptimeRobot, Better Stack) at `https://<domain>/api/health?deep=1`, every 1–5 minutes, alert on non-200. Expect `{"status":"ok","database":{"ok":true,"ms":…}}`. Deep checks are limited to 30 per minute per caller.

## Logs worth searching
| Event | Meaning |
| --- | --- |
| `webhook.invalid_signature` | Someone posted a payment webhook with a bad signature. A burst means probing; a single one from the provider means the signing secret is wrong. |
| `payments.*` warnings | Provider or amount mismatches; check Admin → Finance for parked events. |
| `ai.provider_failed` / `ai.bad_shape` | The AI provider failed or returned something unusable (see `kind`). |
| `disputes.*_failed`, `seller.*_failed` | A database call failed; the user saw a generic message, the cause is here. |
| `jobs.sweep_done` / `jobs.sweep_failed` | Nightly job results. If `sweep_done` is missing for 2+ days, check `CRON_SECRET` and Vercel Cron. |
Sensitive keys (phone, code, token, secret, …) are redacted by the logger before writing.

Every response carries an `x-request-id` header. Ask users to quote it (browser dev tools → Network) and search the logs around that time.

## Routine tasks
- **Run housekeeping now:** Admin → Orders → "Run housekeeping now" (expires unpaid orders, auto-releases silent deliveries).
- **Turn the AI on/off:** Admin → Settings → AI assistants → `ai.enabled`. Off at once; no deploy needed.
- **Pay out / refund:** payouts and refunds are recorded by an admin after sending money outside the platform until a provider adapter is live (Admin → Finance).

## Incidents
1. **Site down / 5xx:** Vercel → Deployments. If the latest deploy is the cause, *Promote* the previous READY deployment (instant rollback). Then investigate.
2. **Database unreachable:** `/api/health?deep=1` shows `database.ok:false`. Check Supabase status and project health (paused? connection limits?).
3. **Suspected leak of a secret:** rotate it at the source (Supabase → API keys / Vercel env var / provider portal), update Vercel, redeploy. Secrets that exist: `SUPABASE_SECRET_KEY`, `SANDBOX_WEBHOOK_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, provider keys (later).
4. **Payment webhook storm:** the endpoint returns 429 after 120 requests/min per caller (best-effort per server instance). For a hard global limit add a Vercel Firewall rate-limit rule on `/api/webhooks/*` (see below).
5. **Money looks wrong:** do not edit data. Admin → Finance → reconciliation; the ledger is append-only and every release/refund is audited. Escalate with the order number.

## Vercel Firewall rules (recommended before launch)
The in-app limiter keeps counters per server instance, so it blunts bursts but is not a global quota. In Vercel → Project → Firewall add:
- Rate limit `/api/webhooks/*`: 300 requests / minute / IP → 429.
- Rate limit `/sign-in` and `/api/health`: 60 / minute / IP.
(Plan limits apply; Hobby supports a small number of custom rules.)

## Database
- Migrations live in `supabase/migrations/` and are applied in order; never edit an applied one — add a new file.
- Local verification: `npm run test:db` (all migrations + 600+ assertions) and `npm run test:concurrency` (parallel-connection race tests).
- Advisor: Supabase → Advisors. The `authenticated_security_definer_function_executable` warnings are intentional (each function checks the caller's role inside); "unused index" notices are expected on a young database — don't drop indexes until there is real traffic.
- Backups: enable Point-in-Time Recovery on a paid Supabase plan before launch; free-tier daily backups are not enough for a money platform.
