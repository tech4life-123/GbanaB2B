import "server-only";
import { AppError } from "@/lib/errors";
import type { PaymentProvider, PaymentProviderId } from "../types";
import { PAYMENT_PROVIDERS } from "../types";

/**
 * Placeholder for MTN MoMo and Orange Money Liberia.
 *
 * These are deliberately NOT implemented: adapters are written only from the
 * providers' official API documentation with real credentials, and this
 * project has neither yet. Until then the provider reports itself as not
 * configured, every call refuses, and no webhook is ever accepted.
 * See docs/payments/adding-a-provider.md.
 */
export function unconfiguredProvider(id: Exclude<PaymentProviderId, "sandbox">): PaymentProvider {
  const refuse = (): never => {
    throw new AppError("NOT_CONFIGURED", `${PAYMENT_PROVIDERS[id].displayName} isn't connected yet.`);
  };
  return {
    id,
    displayName: PAYMENT_PROVIDERS[id].displayName,
    isConfigured: () => false,
    requestCollection: async () => refuse(),
    getStatus: async () => refuse(),
    verifyWebhook: async () => null,
  };
}
