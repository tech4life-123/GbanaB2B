import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs, OrderList } from "@/features/commerce/components/order-bits";
import { countOrdersByStatus, listOrders } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";
import { ORDER_GROUPS, type OrderStatus } from "@/lib/orders/state";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "active", label: "Active", statuses: ORDER_GROUPS.active },
  { key: "closed", label: "Closed", statuses: ORDER_GROUPS.closed },
  { key: "all", label: "All", statuses: [] as readonly OrderStatus[] },
] as const;

export default async function BuyerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; placed?: string }> }) {
  const viewer = await requireRole("buyer");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const [orders, counts] = await Promise.all([
    listOrders({ scope: "buyer", viewerId: viewer.id, statuses: tab.statuses }),
    countOrdersByStatus({ scope: "buyer", viewerId: viewer.id }),
  ]);
  const count = (s: readonly OrderStatus[]) => (s.length ? s.reduce((n, k) => n + (counts[k] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + (b ?? 0), 0));
  const placed = Number.parseInt(sp.placed ?? "", 10);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Buyer" title="Orders" description="Every order from placement to delivery, with its proforma invoice." />
      {placed > 0 && (
        <Alert tone="success" title={`${placed} orders placed`}>
          Each seller will confirm stock and issue a proforma invoice. We&apos;ll show every update here.
        </Alert>
      )}
      <FilterTabs label="Filter orders" active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/buyer/orders?tab=${t.key}`, count: count(t.statuses) }))} />
      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-5" />} title={tab.key === "active" ? "No active orders" : "No orders here"} action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>}>
          Add products to your cart and check out — each seller gets their own order.
        </EmptyState>
      ) : (
        <OrderList orders={orders} hrefBase="/buyer/orders" counterpart="seller" />
      )}
    </div>
  );
}
