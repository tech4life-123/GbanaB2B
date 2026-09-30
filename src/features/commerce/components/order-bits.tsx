import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { formatWeight } from "@/lib/logistics/units";
import { ORDER_STATUS, type OrderStatus } from "@/lib/orders/state";
import { cn } from "@/lib/utils/cn";
import type { AddressSnapshot, OrderListItem } from "../queries";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS[status];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Monrovia",
});

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}
export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso));
}

/** "Bag of rice × 60, Oil × 6 +1 more" */
export function itemsSummary(items: { title: string; quantity: number }[], max = 2) {
  const nf = new Intl.NumberFormat("en-US");
  const shown = items.slice(0, max).map((i) => `${i.title} × ${nf.format(i.quantity)}`);
  return items.length > max ? `${shown.join(", ")} +${items.length - max} more` : shown.join(", ");
}

export function AddressBlock({ address, className }: { address: AddressSnapshot; className?: string }) {
  return (
    <address className={cn("text-sm leading-relaxed text-trade-800 not-italic", className)}>
      <span className="font-semibold text-trade-900">{address.contact_name}</span>
      <span className="tabular block font-mono text-[0.8125rem]">{address.contact_phone}</span>
      {address.street && <span className="block">{address.street}</span>}
      <span className="block">
        {address.town}, {address.county} County
      </span>
      {address.landmark && <span className="block text-muted">Near {address.landmark}</span>}
    </address>
  );
}

/**
 * Order rows for buyer, seller and admin lists. `counterpart` picks which
 * party to show: the seller for buyers, the buyer for sellers, both for admins.
 */
export function OrderList({
  orders,
  hrefBase,
  counterpart,
  showProceeds,
}: {
  orders: OrderListItem[];
  hrefBase: string;
  counterpart: "seller" | "buyer" | "both";
  showProceeds?: boolean;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {orders.map((o) => {
        const buyer = o.buyer_snapshot.business_name || o.buyer_snapshot.name;
        const who =
          counterpart === "seller" ? o.seller_snapshot.name : counterpart === "buyer" ? buyer : `${buyer} → ${o.seller_snapshot.name}`;
        const amount = showProceeds ? o.subtotal_minor - o.platform_fee_minor : o.total_minor;
        return (
          <li key={o.id}>
            <Link href={`${hrefBase}/${o.id}`} className="group flex items-center gap-3 p-4 hover:bg-canvas sm:gap-4">
              <span className="hidden size-10 shrink-0 place-items-center rounded-md bg-trade-50 text-trade-600 sm:grid">
                <Package className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="tabular font-mono text-sm font-semibold text-trade-900">{o.order_number}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
                <span className="mt-1 block truncate text-sm font-medium text-trade-900">{who}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{itemsSummary(o.items)}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{formatDate(o.placed_at)}</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden="true" />
                    {o.delivery_address.town}
                  </span>
                  <span className="tabular font-mono">{formatWeight(o.total_weight_g)}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <MoneyText value={{ amountMinor: amount, currency: o.currency }} className="text-sm font-semibold text-trade-900" />
                <span className="mt-0.5 block text-[0.6875rem] text-muted">{showProceeds ? "your proceeds" : "goods total"}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Segmented filter used above order lists. */
export function FilterTabs({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-lg border border-line bg-white p-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold",
                  on ? "bg-trade-900 text-white" : "text-trade-700 hover:bg-trade-50",
                )}
              >
                {t.label}
                {t.count !== undefined && <span className={cn("tabular font-mono text-xs", on ? "text-trade-200" : "text-muted")}>{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SummaryRow({ label, children, strong, muted }: { label: ReactNode; children: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={cn("text-sm", muted ? "text-muted" : "text-trade-700")}>{label}</dt>
      <dd className={cn("text-right", strong ? "text-base font-bold text-trade-900" : "text-sm text-trade-900")}>{children}</dd>
    </div>
  );
}
