import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs, OrderList } from "@/features/commerce/components/order-bits";
import { countOrdersByStatus, listOrders } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";
import { ORDER_GROUPS, type OrderStatus } from "@/lib/orders/state";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "action", label: "New", statuses: ORDER_GROUPS.action, empty: "No new orders waiting for you." },
  { key: "progress", label: "Preparing", statuses: ORDER_GROUPS.progress, empty: "Nothing being prepared right now." },
  { key: "ready", label: "Ready", statuses: ORDER_GROUPS.ready, empty: "No orders waiting for pickup." },
  { key: "closed", label: "Closed", statuses: ORDER_GROUPS.closed, empty: "No closed orders." },
  { key: "all", label: "All", statuses: [] as readonly OrderStatus[], empty: "No orders yet." },
] as const;

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("seller");
  const business = await getMyBusiness();
  if (!business) redirect("/seller/business");
  const wanted = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0];
  const [orders, counts] = await Promise.all([
    listOrders({ scope: "seller", businessId: business.id, statuses: tab.statuses }),
    countOrdersByStatus({ scope: "seller", businessId: business.id }),
  ]);
  const count = (s: readonly OrderStatus[]) => (s.length ? s.reduce((n, k) => n + (counts[k] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + (b ?? 0), 0));
  const total = count([]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow={business.trading_name} title="Orders" description="Accept orders you can fill, prepare the goods and get them ready for pickup." />
      <FilterTabs label="Filter orders" active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/seller/orders?tab=${t.key}`, count: count(t.statuses) }))} />
      {orders.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title={total === 0 ? "No orders yet" : tab.empty}
          action={total === 0 ? <ButtonLink href="/seller/listings" variant="secondary">Check your listings</ButtonLink> : undefined}
        >
          {total === 0 ? "Buyers order from your live listings. New orders appear here for you to accept." : undefined}
        </EmptyState>
      ) : (
        <OrderList orders={orders} hrefBase="/seller/orders" counterpart="buyer" showProceeds />
      )}
    </div>
  );
}
