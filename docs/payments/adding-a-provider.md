# Adding MTN MoMo or Orange Money

Do this only with the provider's **official API documentation and sandbox credentials**. Do not guess endpoints or signature schemes.

1. Implement `PaymentProvider` (`src/lib/payments/types.ts`) in `src/lib/payments/providers/<name>.ts`: `requestCollection`, `getStatus`, and `verifyWebhook` (authenticate the message exactly as documented, return a `VerifiedWebhookEvent` with a unique `eventId`, or `null`).
2. Register it in `src/lib/payments/registry.ts` in place of `unconfiguredProvider`, and add its env vars (server-only) to `src/config/env.server.ts` and `.env.example`.
3. Point the provider's webhook at `https://<site>/api/webhooks/payments/<provider id>`.
4. Add contract tests with recorded provider payloads (valid, tampered, replayed, late, wrong amount).
5. Payouts: automated disbursement is not built yet — payouts are recorded by an admin after sending. If the provider offers a disbursement API, add it behind the same interface and record results with `admin_finish_payout`.
6. Switch the provider on with `payments.mtn_enabled` / `payments.orange_enabled` (admin setting, audited) only after a live test. Then turn `payments.sandbox_enabled` off.
