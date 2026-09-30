import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  FileClock,
  Gavel,
  LayoutDashboard,
  MapPin,
  Package,
  Sparkles,
  Route,
  Settings2,
  Star,
  ShoppingBag,
  ShoppingCart,
  Building2,
  Container,
  Store,
  Tags,
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
export const CURRENT_PHASE = 7;

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
    { segment: "cart", label: "Cart", icon: ShoppingCart, phase: 3, summary: "Products you're about to order, grouped by seller.", primary: true },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Track every order from confirmation to delivery, with proforma invoices.", primary: true },
    { segment: "addresses", label: "Addresses", icon: MapPin, phase: 3, summary: "Where carriers deliver your stock." },
    { segment: "freight", label: "Freight", icon: Route, phase: 4, summary: "Freight requests for your orders and the carriers' sealed bids." },
    { segment: "payments", label: "Payments", icon: Wallet, phase: 5, summary: "Mobile Money payments, escrow status and receipts." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Report missing, damaged or wrong goods with photo evidence." },
    { segment: "assistant", label: "Assistant", icon: Sparkles, phase: 7, summary: "Turn a sourcing need into real marketplace searches and plan a delivery." },
  ],
  seller: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Your sales at a glance.", primary: true },
    { segment: "listings", label: "Listings", icon: Package, phase: 2, summary: "Create wholesale listings with MOQs, quantity tiers, weights and packaging.", primary: true },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Accept orders, prepare stock and hand over to the selected carrier.", primary: true },
    { segment: "business", label: "Business", icon: Building2, phase: 2, summary: "Your business profile and verification status." },
    { segment: "payouts", label: "Payouts", icon: Banknote, phase: 5, summary: "Earnings released from escrow, platform fees and payout history." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Disputes on your orders, with evidence and replies." },
    { segment: "reviews", label: "Reviews", icon: Star, phase: 6, summary: "Buyer ratings of your business, and your replies." },
    { segment: "assistant", label: "Assistant", icon: Sparkles, phase: 7, summary: "Draft listings from rough notes and plan a hand-over to a carrier." },
  ],
  carrier: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Your hauling at a glance.", primary: true },
    { segment: "loads", label: "Load board", icon: Truck, phase: 4, summary: "Freight that fits your verified capacity and routes. Bids are sealed.", primary: true },
    { segment: "bids", label: "My bids", icon: Gavel, phase: 4, summary: "Your sealed bids and the jobs you've won.", primary: true },
    { segment: "verification", label: "Verification", icon: BadgeCheck, phase: 4, summary: "Your driver profile, documents and verification status.", primary: true },
    { segment: "vehicles", label: "Vehicles", icon: Container, phase: 4, summary: "Trucks, vans and bikes you haul with." },
    { segment: "deliveries", label: "Deliveries", icon: Route, phase: 6, summary: "Assigned jobs, pickup details and delivery-code confirmation." },
    { segment: "earnings", label: "Earnings", icon: Banknote, phase: 5, summary: "Freight payments released from escrow after confirmed delivery." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Disputes on deliveries you carried." },
    { segment: "reviews", label: "Reviews", icon: Star, phase: 6, summary: "Buyer ratings of your deliveries, and your replies." },
  ],
  admin: [
    { segment: "", label: "Overview", icon: LayoutDashboard, phase: 1, summary: "Platform health and what needs attention.", primary: true },
    { segment: "businesses", label: "Businesses", icon: Store, phase: 2, summary: "Seller businesses, verification and suspension.", primary: true },
    { segment: "users", label: "Users & roles", icon: Users, phase: 1, summary: "Accounts, roles and account status.", primary: true },
    { segment: "categories", label: "Categories", icon: Tags, phase: 2, summary: "Marketplace product categories." },
    { segment: "settings", label: "Settings", icon: Settings2, phase: 1, summary: "Platform fee, OTP windows and other business rules.", primary: true },
    { segment: "audit", label: "Audit log", icon: FileClock, phase: 1, summary: "Permanent record of sensitive actions." },
    { segment: "verification", label: "Carrier checks", icon: BadgeCheck, phase: 4, summary: "Review driver documents and vehicles before carriers can bid." },
    { segment: "freight", label: "Freight", icon: Route, phase: 4, summary: "Every freight request, its sealed bids and the carrier chosen." },
    { segment: "orders", label: "Orders", icon: ClipboardList, phase: 3, summary: "Every order across the marketplace, with delays flagged." },
    { segment: "finance", label: "Finance", icon: Wallet, phase: 5, summary: "Payments, escrow balances, payouts, refunds and reconciliation." },
    { segment: "disputes", label: "Disputes", icon: Gavel, phase: 6, summary: "Open disputes, evidence and resolutions." },
    { segment: "reviews", label: "Reviews", icon: Star, phase: 6, summary: "Moderate buyer reviews of sellers and carriers." },
    { segment: "assistant", label: "Assistant", icon: Sparkles, phase: 7, summary: "Marketplace numbers with a plain-language briefing. Advisory only." },
  ],
};

export function navHref(role: Role, segment: string): string {
  return segment ? `/${role}/${segment}` : `/${role}`;
}

export function findNavItem(role: Role, segment: string): NavItem | undefined {
  return NAV[role].find((i) => i.segment === segment);
}
