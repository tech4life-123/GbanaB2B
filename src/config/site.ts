/**
 * Static brand + product identity. Business rules (fees, OTP windows, …)
 * do NOT live here — they live in the `platform_settings` table so admins
 * can change them with an audit trail. See docs/decisions/0004-configurable-business-rules.md.
 */
export const siteConfig = {
  name: "GbanaB2B",
  tagline: "Wholesale & Freight Exchange",
  description:
    "Liberia's B2B wholesale marketplace and freight exchange. Buy in bulk from verified suppliers, get competing bids from verified carriers, and pay through protected escrow.",
  market: "Liberia",
  defaultCurrency: "USD",
  supportedCurrencies: ["USD", "LRD"] as const,
  countryCallingCode: "231",
  themeColor: "#0F2027",
} as const;

/** Brand colours, mirrored from globals.css for places CSS can't reach (manifest, icons, emails). */
export const brandColors = {
  tradeNavy: "#0F2027",
  electricAmber: "#FF9900",
  gold: "#F59E0B",
  escrowEmerald: "#10B981",
  slate: "#F8FAFC",
} as const;
