import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  FileClock,
  Gavel,
  LayoutDashboard,
  Package,
  Route,
  Settings2,
  ShoppingBag,
  Building2,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  /** URL segment under the role home. Empty string = overview. */
  segment: string;
  label: string;
  icon: LucideIcon;
  /** Roadmap phase that delivers this section. Items above CURRENT_PHASE render a planned-state page. */
  phase: number;
  /** One-line promise shown on the planned-state page. */
  summary: string;
  /** Show in the phone bottom bar (max 4 per role). */
  primary?: boolean;
}

/** Phase the codebase has completed. Bump when a phase's definition of done is met. */
export const CURRENT_PHASE = 1;

export const PHASE_NAMES: Record<number, string> = {
  1: "Foundation",
  2: "Marketplace",
  3: "B2B commerce",
  4: "Freight exchange",
  5: "Financial engine",
  6: "Delivery & trust",
  7: "AI assistants",
  8: "Production hardening",
};

export const NAV: Record<Role, NavItem[]> = {
  buyer: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Your buying at a glance.", primary: true },
    { segment: "marketplace", label: "Marketplace", icon: ShoppingBag, phase: 2, summary: "Search wholesale stock by category, MOQ, price tier and seller.", primary: true },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Track every order from confirmation to delivery, with proforma invoices.", primary: true },
    { segment: "freight", label: "Freight", icon: Route, phase: 4, summary: "Request freight, compare sealed carrier bids and pick on price and ETA.", primary: true },
    { segment: "payments", label: "Payments", icon: Wallet, phase: 5, summary: "Mobile Money payments, escrow status and receipts." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Report missing, damaged or wrong goods with photo evidence." },
  ],
  seller: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Your sales at a glance.", primary: true },
    { segment: "listings", label: "Listings", icon: Package, phase: 2, summary: "Create wholesale listings with MOQs, quantity tiers, weights and packaging.", primary: true },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Accept orders, prepare stock and hand over to the selected carrier.", primary: true },
    { segment: "business", label: "Business", icon: Building2, phase: 2, summary: "Your business profile, team members and verification documents." },
    { segment: "payouts", label: "Payouts", icon: Banknote, phase: 5, summary: "Earnings released from escrow, platform fees and payout history.", primary: true },
  ],
  carrier: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Your hauling at a glance.", primary: true },
    { segment: "verification", label: "Verification", icon: BadgeCheck, phase: 4, summary: "Submit your licence, ID and vehicle details for review by our team.", primary: true },
    { segment: "loads", label: "Load board", icon: Truck, phase: 4, summary: "Freight that fits your verified capacity and routes. Bids are sealed.", primary: true },
    { segment: "deliveries", label: "Deliveries", icon: Route, phase: 6, summary: "Assigned jobs, pickup details and delivery-code confirmation." },
    { segment: "earnings", label: "Earnings", icon: Banknote, phase: 5, summary: "Freight payments released from escrow after confirmed delivery.", primary: true },
  ],
  admin: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Platform health and what needs attention.", primary: true },
    { segment: "users", label: "Users & roles", icon: Users, phase: 1, summary: "Accounts, roles and account status.", primary: true },
    { segment: "settings", label: "Settings", icon: Settings2, phase: 1, summary: "Platform fee, OTP windows and other business rules.", primary: true },
    { segment: "audit", label: "Audit log", icon: FileClock, phase: 1, summary: "Permanent record of sensitive actions.", primary: true },
    { segment: "verification", label: "Verification", icon: BadgeCheck, phase: 4, summary: "Review driver documents, vehicles and business verification." },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Every order across the marketplace, with delays flagged." },
    { segment: "finance", label: "Finance", icon: Wallet, phase: 5, summary: "Payments, escrow balances, payouts, refunds and reconciliation." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Open disputes, evidence and resolutions." },
  ],
};

export function navHref(role: Role, segment: string): string {
  return segment ? `/${role}/${segment}` : `/${role}`;
}

export function findNavItem(role: Role, segment: string): NavItem | undefined {
  return NAV[role].find((i) => i.segment === segment);
}
