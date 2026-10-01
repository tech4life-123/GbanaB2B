# Launch checklist

Tick every line before real money or real customers. Items marked **(you)** need something only the owner can do.

## Accounts and providers
- [ ] **(you)** MTN MoMo and Orange Money merchant accounts + API documentation + sandbox credentials. Adapters are written only from the verified docs (ADR 0015).
- [ ] **(you)** SMS provider for +231 numbers connected in Supabase Auth (phone OTP).
- [ ] **(you)** Production domain bought, added in Vercel, `NEXT_PUBLIC_SITE_URL`/redirect URLs updated in Supabase Auth.
- [ ] **(you)** `ANTHROPIC_API_KEY` set (optional) and `ai.enabled` flipped when ready.

## Security switches
- [ ] `DEMO_ACCESS_ENABLED=false` (temporary email+password sign-in off) — only after SMS works.
- [ ] Temporary pre-provisioned demo accounts removed.
- [ ] `payments.sandbox_enabled` = 0 (test provider off) and the real provider flags on.
- [ ] Supabase Auth: leaked-password protection on (while any password sign-in exists), email sign-ups off, OTP expiry ≤ 10 min.
- [ ] `CRON_SECRET` set on Vercel (the sweep refuses without it).
- [ ] Vercel Firewall rate-limit rules added (runbook).
- [ ] No secrets in the repo (`git log -p | grep -i secret` check) and `.env*` ignored.

## Data protection
- [ ] Supabase Point-in-Time Recovery on; one restore rehearsal done.
- [ ] Storage buckets: `product-images` public by design; `carrier-documents` and `dispute-evidence` private (verify in Supabase → Storage).
- [ ] Terms of service, privacy policy and escrow/dispute terms published and linked (written with a Liberian lawyer).

## Verify the release
- [ ] `npm run check` (lint, typecheck, unit tests, build) green.
- [ ] `npm run test:db` and `npm run test:concurrency` green.
- [ ] Supabase advisors: only the documented warnings.
- [ ] `npm run build && npm start`, then `python3 scripts/a11y-audit.py` and `python3 scripts/perf-3g.py http://localhost:3301 / /marketplace` — no serious findings; first paint under ~3 s on Slow 3G.
- [ ] Signed-in accessibility pass of buyer, seller, carrier and admin screens (the scripted scan covers public pages only).
- [ ] Real-device test on a mid-range Android phone over mobile data in Liberia: sign-in, browse, add to cart, order, pay with a real small amount, delivery code, dispute.

## Day one
- [ ] Uptime monitor on `/api/health?deep=1`; alert goes to a phone that gets answered.
- [ ] Someone assigned to check Admin → Finance and Disputes daily.
- [ ] Pilot with a small number of known businesses before opening to everyone.
