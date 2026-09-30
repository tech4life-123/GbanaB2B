import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs } from "@/features/commerce/components/order-bits";
import { formatDay } from "@/features/carrier/components/load-bits";
import { listMyBids } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { BID_STATUS, formatEta, type BidStatus } from "@/lib/freight";
import { formatWeight } from "@/lib/logistics/units";

export const metadata: Metadata = { title: "My bids" };

const TABS: { key: string; label: string; statuses: BidStatus[] }[] = [
  { key: "live", label: "Live", statuses: ["submitted"] },
  { key: "won", label: "Won", statuses: ["accepted"] },
  { key: "past", label: "Past", statuses: ["rejected", "withdrawn", "expired"] },
];

export default async function MyBidsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireRole("carrier");
  const wanted = (await searchParams).tab;
  const all = await listMyBids(viewer.id);
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0]!;
  const bids = all.filter((b) => tab.statuses.includes(b.status));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="My bids" description="Only you and the buyer can see these. Won jobs show the pickup and drop-off contacts." />
      <FilterTabs
        label="Filter bids"
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/carrier/bids?tab=${t.key}`, count: all.filter((b) => t.statuses.includes(b.status)).length }))}
      />
      {bids.length === 0 ? (
        <EmptyState icon={<Gavel className="size-5" />} title={tab.key === "won" ? "No jobs won yet" : tab.key === "live" ? "No live bids" : "Nothing here yet"} action={<ButtonLink href="/carrier/loads">Open load board</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {bids.map((b) => (
            <li key={b.id}>
              <Link href={`/carrier/loads/${b.rfq_id}`} className="group flex items-center gap-3 p-4 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-trade-900">
                      {b.rfq ? `${b.rfq.pickup_town} → ${b.rfq.destination_town}` : "Load"}
                    </span>
                    <Badge tone={BID_STATUS[b.status].tone}>{BID_STATUS[b.status].label}</Badge>
                  </p>
                  <p className="tabular mt-1 font-mono text-xs text-muted">
                    {b.rfq?.rfq_number} · {b.rfq ? formatWeight(b.rfq.cargo_weight_g) : ""} · pickup {b.rfq ? formatDay(b.rfq.pickup_date) : ""} · {formatEta(b.eta_hours)}
                  </p>
                </div>
                <MoneyText value={{ amountMinor: b.amount_minor, currency: b.currency }} className="shrink-0 text-sm font-semibold text-trade-900" />
                <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
