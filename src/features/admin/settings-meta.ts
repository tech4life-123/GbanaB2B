import { formatBps } from "@/lib/money/currency";
import type { Json } from "@/lib/db/types";

/** Human labels and formatting for known settings. Unknown keys fall back to the raw key. */
export const SETTING_META: Record<string, { label: string; unit?: string; format?: (v: Json) => string }> = {
  "commerce.platform_fee_bps": { label: "Platform fee", unit: "basis points", format: (v) => `${formatBps(Number(v))} (${v} bps)` },
  "commerce.order_cancellation_window_minutes": { label: "Order cancellation window", unit: "minutes", format: (v) => `${v} min` },
  "freight.bid_expiry_hours": { label: "Freight bid window", unit: "hours", format: (v) => `${v} h` },
  "delivery.otp_expiry_minutes": { label: "Delivery code lifetime", unit: "minutes", format: (v) => `${v} min` },
  "delivery.otp_max_attempts": { label: "Delivery code attempts", unit: "attempts", format: (v) => `${v} tries` },
  "auth.max_login_attempts": { label: "Sign-in attempts before lock", unit: "attempts", format: (v) => `${v} tries` },
  "payments.sandbox_enabled": { label: "Test payment provider", unit: "1 = on, 0 = off", format: (v) => (String(v) === "1" ? "ON (test money)" : "Off") },
  "payments.mtn_enabled": { label: "MTN Mobile Money", unit: "1 = on, 0 = off", format: (v) => (String(v) === "1" ? "On" : "Off") },
  "payments.orange_enabled": { label: "Orange Money", unit: "1 = on, 0 = off", format: (v) => (String(v) === "1" ? "On" : "Off") },
  "payments.intent_expiry_minutes": { label: "Payment approval window", unit: "minutes", format: (v) => `${v} min` },
  "fx.display_currency": { label: "Default display currency" },
};

export function settingLabel(key: string) {
  return SETTING_META[key]?.label ?? key;
}

export function formatSettingValue(key: string, value: Json): string {
  const f = SETTING_META[key]?.format;
  if (f) return f(value);
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function settingGroup(key: string) {
  const group = key.split(".")[0] ?? "other";
  return (
    { commerce: "Commerce", freight: "Freight", delivery: "Delivery", auth: "Security", fx: "Currency", payments: "Payments" } as Record<string, string>
  )[group] ?? "Other";
}
