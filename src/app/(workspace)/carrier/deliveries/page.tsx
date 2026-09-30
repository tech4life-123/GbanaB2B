import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { FilterTabs } from "@/features/commerce/components/order-bits";
import { JobList } from "@/features/delivery/components/job-list";
import { listCarrierJobs } from "@/features/delivery/queries";
import { requireRole } from "@/lib/auth/session";
import { carrierStage } from "@/lib/trust/labels";

export const metadata: Metadata = { title: "Deliveries" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "done", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function CarrierDeliveriesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireRole("carrier");
  const wanted = (await searchParams).tab;
  const all = await listCarrierJobs(viewer.id);
  const pick = (key: string) =>
    all.filter((j) => (key === "cancelled" ? j.assignment.status === "cancelled" : j.assignment.status === "active" && (key === "done" ? carrierStage(j.delivery) === "completed" : carrierStage(j.delivery) !== "completed")));
  const tab = TABS.find((t) => t.key === wanted)?.key ?? "active";
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="Deliveries" description="Jobs you've won. Collect the goods once the buyer's payment is in escrow, then confirm delivery with the buyer's code." />
      <FilterTabs label="Filter deliveries" active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/carrier/deliveries?tab=${t.key}`, count: pick(t.key).length }))} />
      <JobList jobs={pick(tab)} />
    </div>
  );
}
