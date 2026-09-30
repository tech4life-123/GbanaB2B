import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs, formatDate } from "@/features/commerce/components/order-bits";
import { countCarriersByStatus, listCarriersForReview } from "@/features/freight/queries";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_STATUS, type CarrierStatus } from "@/lib/freight";

export const metadata: Metadata = { title: "Carrier checks" };

const TABS: { key: CarrierStatus | "all"; label: string }[] = [
  { key: "under_review", label: "To review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Needs changes" },
  { key: "suspended", label: "Suspended" },
  { key: "pending", label: "Not submitted" },
  { key: "all", label: "All" },
];

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const wanted = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0]!;
  const [carriers, counts] = await Promise.all([listCarriersForReview(tab.key), countCarriersByStatus()]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Carrier checks" description="Check each driver's licence, ID and vehicles before they can bid. Every decision is audited." />
      <FilterTabs
        label="Filter carriers"
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/verification?tab=${t.key}`, count: t.key === "all" ? total : counts[t.key] ?? 0 }))}
      />
      {carriers.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="size-5" />} title={tab.key === "under_review" ? "Nothing waiting for review" : "No carriers here"} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {carriers.map((c) => {
            const meta = CARRIER_STATUS[c.verification_status];
            const verifiedVehicles = c.vehicles.filter((v) => v.is_verified).length;
            return (
              <li key={c.id}>
                <Link href={`/admin/verification/${c.id}`} className="group flex items-center gap-3 p-4 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-trade-900">{c.full_name}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {c.home_town}, {c.home_county} · covers {c.coverage_counties.length} {c.coverage_counties.length === 1 ? "county" : "counties"}
                    </p>
                    <p className="tabular mt-1 font-mono text-xs text-muted">
                      {c.vehicles.length} vehicles ({verifiedVehicles} verified) · {c.documents.length} documents
                      {c.submitted_at && ` · submitted ${formatDate(c.submitted_at)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
