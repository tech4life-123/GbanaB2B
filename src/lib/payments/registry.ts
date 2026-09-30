import "server-only";
import type { PaymentProvider, PaymentProviderId } from "./types";
import { sandboxProvider } from "./providers/sandbox";
import { unconfiguredProvider } from "./providers/unconfigured";

const providers: Record<PaymentProviderId, PaymentProvider> = {
  sandbox: sandboxProvider,
  mtn_momo_lr: unconfiguredProvider("mtn_momo_lr"),
  orange_money_lr: unconfiguredProvider("orange_money_lr"),
};

export function isProviderId(value: string): value is PaymentProviderId {
  return value in providers;
}

export function getProvider(id: PaymentProviderId): PaymentProvider {
  return providers[id];
}
