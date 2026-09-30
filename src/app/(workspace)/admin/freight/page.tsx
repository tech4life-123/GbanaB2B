import type { Metadata } from "next";
import { Route } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs } from "@/features/commerce/components/order-bits";
import { RfqList } from "@/features/freight/components/rfq-list";
import { listRfqs } from "@/features/freight/queries";
import { requireRole } from "@/lib/auth/session";
import type { RfqStatus } from "@/lib/freight";

export const metadata: Metadata = { title: "Freight" };

const TABS: { key: string; label: string; statuses: RfqStatus[] }[] = [
  { key: "open", label: "Taking bids", statuses: ["open"] },
  { key: "awarded", label: "Carrier chosen", statuses: ["awarded"] },
  { key: "closed", label: "Cancelled", statuses: ["cancelled", "expired"] },
  { key: "all", label: "All", statuses: [] },
];

export default async function AdminFreightPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const wanted = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0]!;
  const rfqs = await listRfqs({ scope: "admin", statuses: tab.statuses, limit: 200 });
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Freight" description="Every freight request with its bid count. Open one to see the sealed bids and the carrier chosen." />
      <FilterTabs label="Filter freight" active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/freight?tab=${t.key}` }))} />
      {rfqs.length === 0 ? <EmptyState icon={<Route className="size-5" />} title="Nothing here" /> : <RfqList rfqs={rfqs} orderHref={(id) => `/admin/orders/${id}`} />}
    </div>
  );
}
