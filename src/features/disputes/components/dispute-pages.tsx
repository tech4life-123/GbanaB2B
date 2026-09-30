import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getDispute, getMaxEvidenceFiles, listDisputes } from "../queries";
import { DisputeList } from "./dispute-list";
import { getAiStatus } from "@/features/ai/run";
import { DisputeView } from "./dispute-view";
import { PageHeader } from "@/components/ui/feedback";
import { FilterTabs } from "@/features/commerce/components/order-bits";
import type { DisputeStatus } from "@/lib/trust/labels";

type Role = "buyer" | "seller" | "carrier" | "admin";

const TABS: { key: string; label: string; statuses?: DisputeStatus[] }[] = [
  { key: "live", label: "Open", statuses: ["open", "under_review"] },
  { key: "closed", label: "Closed", statuses: ["resolved", "rejected", "refunded", "partial_refund"] },
  { key: "all", label: "All" },
];

/** Shared by every role's /disputes route: the query is RLS-scoped, so each sees only their own. */
export async function DisputesIndex({ role, tab: wanted }: { role: Role; tab?: string }) {
  await requireRole(role);
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0]!;
  const all = await listDisputes({ limit: 200 });
  const items = tab.statuses ? all.filter((d) => tab.statuses!.includes(d.status)) : all;
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow={role === "admin" ? "Admin" : role[0]!.toUpperCase() + role.slice(1)}
        title="Disputes"
        description={role === "admin" ? "Open disputes freeze the payment for their order. Review the evidence, then decide." : "Problems reported on orders you're part of, with evidence and the decision."}
      />
      <FilterTabs
        label="Filter disputes"
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/${role}/disputes?tab=${t.key}`, count: t.statuses ? all.filter((d) => t.statuses!.includes(d.status)).length : all.length }))}
      />
      <DisputeList items={items} role={role} emptyTitle={tab.key === "live" ? "No open disputes" : "Nothing here yet"} />
    </div>
  );
}

export async function DisputePage({ role, id }: { role: Role; id: string }) {
  const viewer = await requireRole(role);
  const [detail, maxEvidence, ai] = await Promise.all([getDispute(id), getMaxEvidenceFiles(), role === "admin" ? getAiStatus() : null]);
  if (!detail) notFound();
  return <DisputeView detail={detail} role={role} viewerId={viewer.id} maxEvidence={maxEvidence} aiReady={Boolean(ai?.configured && ai.enabled)} />;
}
