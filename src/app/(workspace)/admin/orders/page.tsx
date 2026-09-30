import type { Metadata } from "next";
import { ClipboardList, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { FilterTabs, OrderList } from "@/features/commerce/components/order-bits";
import { RunSweepButton } from "@/features/delivery/components/buyer-controls";
import { countOrdersByStatus, listOrders } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";
import { ORDER_GROUPS, type OrderStatus } from "@/lib/orders/state";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "action", label: "Awaiting seller", statuses: ORDER_GROUPS.action },
  { key: "active", label: "Active", statuses: ORDER_GROUPS.active },
  { key: "cancelled", label: "Cancelled", statuses: ORDER_GROUPS.cancelled },
  { key: "all", label: "All", statuses: [] as readonly OrderStatus[] },
] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[1];
  const q = (sp.q ?? "").trim().slice(0, 30);
  const [orders, counts] = await Promise.all([
    listOrders({ scope: "admin", statuses: q ? [] : tab.statuses, search: q || undefined, limit: 200 }),
    countOrdersByStatus({ scope: "admin" }),
  ]);
  const count = (s: readonly OrderStatus[]) => (s.length ? s.reduce((n, k) => n + (counts[k] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + (b ?? 0), 0));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Orders" description="Every order on the marketplace. Admins can cancel with a reason; only sellers accept orders." actions={<RunSweepButton />} />
      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Order number
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder="Order number, e.g. GB-2609-001001" className="font-mono" />
        <Button type="submit" variant="secondary" icon={<Search className="size-4" aria-hidden="true" />}>
          Find
        </Button>
      </form>
      {!q && <FilterTabs label="Filter orders" active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/orders?tab=${t.key}`, count: count(t.statuses) }))} />}
      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-5" />} title={q ? "No matching orders" : "No orders here"} />
      ) : (
        <OrderList orders={orders} hrefBase="/admin/orders" counterpart="both" />
      )}
    </div>
  );
}
