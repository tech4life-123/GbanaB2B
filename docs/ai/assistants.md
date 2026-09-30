# AI assistants (Phase 7)

**Principle:** advisory only. The model has no tools, no credentials and no write path. It returns text that a person reads.

## Assistants
| Assistant | Who | Output | Grounded in |
| --- | --- | --- | --- |
| Buyer | buyers | search phrases, MOQ/quantity notes, seller questions | server then runs real catalogue searches |
| Seller listing | sellers | title, description, specs, category | category must exist in `product_categories`; seller copies into the normal validated form |
| Freight | buyers, sellers | packing/handover tips | vehicle class computed by `carrierClassFor` (not AI) |
| Admin briefing | admins | headline, highlights, attention list | `admin_marketplace_snapshot()` aggregates |
| Dispute summary | admins | neutral recap, points to consider, missing info | dispute text (redacted); never an outcome or amount |

## Request path (`src/features/ai/run.ts`)
1. No `ANTHROPIC_API_KEY` → honest "not connected" (nothing counted).
2. `ai_take_quota(assistant)` in the database: checks signed-in, `ai.enabled = 1`, role for that assistant, per-minute and rolling 24 h limits; logs a row (user, assistant, time — no prompt or answer).
3. Provider call (`src/lib/ai/anthropic.ts`, plain fetch, 25 s timeout).
4. Reply must parse to one JSON object and pass the zod schema (`schemas.ts`) or it is discarded.

## Safety measures
- User text is redacted (emails, phones, codes) and fenced in `<untrusted>` tags; the system prompt says to treat it as data.
- Context is read with the user's own RLS client, never the service role.
- Output is rendered as plain text. Nothing is executed or applied.
- Admin snapshot returns counts and totals only; "suspicious pattern" numbers are deterministic and labelled as counts, not findings.

## Settings (Admin → Settings → AI assistants)
`ai.enabled` (0), `ai.requests_per_day` (30), `ai.requests_per_minute` (6), `ai.max_input_chars` (6000). Env: `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-haiku-4-5-20251001`).

## Turning it on
1. Add `ANTHROPIC_API_KEY` (and optionally `AI_MODEL`) in Vercel, redeploy.
2. Admin sets `ai.enabled` to 1. The change is audited.
