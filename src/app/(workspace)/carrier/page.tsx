import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { PageHeader, Stat } from "@/components/ui/feedback";
import { PrepareCard, SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { formatDay } from "@/features/carrier/components/load-bits";
import { getMyCarrier, listLoads, listMyAssignments, listMyBids } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_STATUS, onboardingGaps, type CarrierStatus } from "@/lib/freight";

export const metadata: Metadata = { title: "Carrier workspace" };

const STEPS: { key: CarrierStatus | "submitted"; label: string }[] = [
  { key: "pending", label: "Profile & documents" },
  { key: "under_review", label: "Under review" },
  { key: "verified", label: "Verified" },
];

export default async function CarrierOverviewPage() {
  const viewer = await requireRole("carrier");
  const name = viewer.profile?.display_name || viewer.profile?.full_name;
  const carrier = await getMyCarrier(viewer.id);
  const status = carrier.profile?.verification_status ?? "pending";
  const verified = status === "verified";
  const [loads, bids, jobs] = verified
    ? await Promise.all([listLoads(viewer.id), listMyBids(viewer.id), listMyAssignments(viewer.id)])
    : [[], [], []];
  const activeJobs = jobs.filter((j) => j.status === "active");
  const gaps = onboardingGaps({
    hasProfile: Boolean(carrier.profile),
    activeVehicles: carrier.vehicles.filter((v) => v.is_active).length,
    documents: carrier.documents.map((d) => d.doc_type),
  });
  const stepIndex = status === "verified" ? 2 : status === "under_review" ? 1 : 0;
  const meta = CARRIER_STATUS[status];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Carrier workspace"
        title={`Welcome, ${firstName(name)}`}
        description="Get verified once, then bid on loads that fit your vehicle and routes."
        actions={verified ? <ButtonLink href="/carrier/loads" icon={<Truck className="size-4" aria-hidden="true" />}>Open load board</ButtonLink> : undefined}
      />

      {verified ? (
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/carrier/loads" className="rounded-lg focus-visible:outline-2 focus-visible:outline-signal-500">
            <Stat label="Open loads for you" value={loads.filter((l) => !l.myBid).length} hint="Not yet bid on" />
          </Link>
          <Link href="/carrier/bids" className="rounded-lg focus-visible:outline-2 focus-visible:outline-signal-500">
            <Stat label="Live bids" value={bids.filter((b) => b.status === "submitted").length} hint="Waiting for buyers" />
          </Link>
          <Link href="/carrier/bids?tab=won" className="rounded-lg focus-visible:outline-2 focus-visible:outline-signal-500">
            <Stat label="Jobs won" value={activeJobs.length} tone="escrow" hint="Active assignments" />
          </Link>
          <Stat label="Verified vehicles" value={carrier.vehicles.filter((v) => v.is_verified && v.is_active).length} hint={carrier.profile?.is_available ? "Available for loads" : "Marked unavailable"} />
        </section>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="bg-manifest p-6 text-white">
              <p className="label-caps text-trade-300">Verification status</p>
              <div className="mt-3">
                <Badge tone="navy" className="!bg-white/10 !ring-white/15">
                  {meta.label}
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-trade-200">{meta.hint}</p>
              <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs" aria-label="Verification steps">
                {STEPS.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
                    {i > 0 && <span className="h-px w-4 bg-white/20" aria-hidden="true" />}
                    <span className={i <= stepIndex ? "rounded-sm bg-signal-500 px-2 py-1 font-semibold text-trade-900" : "rounded-sm bg-white/5 px-2 py-1 font-medium text-trade-200 ring-1 ring-white/10"}>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <CardBody className="flex flex-col justify-center gap-3 p-6">
              {status === "under_review" ? (
                <>
                  <p className="font-bold text-trade-900">We&apos;re checking your documents</p>
                  <p className="text-sm leading-relaxed text-muted">You&apos;ll see loads here as soon as you&apos;re approved.</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-trade-900">{gaps.length ? `${gaps.length} ${gaps.length === 1 ? "step" : "steps"} left` : "Ready to submit"}</p>
                  {gaps.length > 0 && (
                    <ul className="space-y-1 text-sm text-muted">
                      {gaps.map((g) => (
                        <li key={g}>• {g}</li>
                      ))}
                    </ul>
                  )}
                  <ButtonLink href="/carrier/verification" className="self-start" icon={<ArrowRight className="order-last size-4" aria-hidden="true" />}>
                    {carrier.profile ? "Continue verification" : "Start verification"}
                  </ButtonLink>
                </>
              )}
            </CardBody>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {verified && activeJobs.length > 0 ? (
          <Card>
            <CardHeader eyebrow="Won" title="Your jobs" />
            <ul className="divide-y divide-line">
              {activeJobs.slice(0, 5).map((j) => {
                const p = j.pickup_snapshot as { town?: string };
                const d = j.dropoff_snapshot as { town?: string };
                return (
                  <li key={j.id}>
                    <Link href={`/carrier/loads/${j.rfq_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                      <span>
                        <span className="block font-semibold text-trade-900">
                          {p.town} → {d.town}
                        </span>
                        <span className="text-xs text-muted">Deliver by {formatDay(j.proposed_delivery_date)}</span>
                      </span>
                      <MoneyText value={{ amountMinor: j.amount_minor, currency: j.currency }} className="text-sm font-semibold text-trade-900" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <PrepareCard
            eyebrow={verified ? "Tips" : "Prepare now"}
            title={verified ? "Win more jobs" : "Documents you'll need"}
            icon={<FileCheck2 className="size-5" />}
            items={
              verified
                ? [
                    { label: "Cover more counties", detail: "You only see loads where both ends are on your routes." },
                    { label: "Register every vehicle", detail: "Bigger verified payloads unlock bigger loads." },
                    { label: "Bid early, bid clearly", detail: "Buyers compare price, travel time and delivery date." },
                  ]
                : [
                    { label: "Driver's licence", detail: "Valid and readable." },
                    { label: "National ID or passport", detail: "Must match the name on your licence." },
                    { label: "Vehicle details", detail: "Type, plate number and maximum load in kg." },
                    { label: "Routes you cover", detail: "Your base town and the counties you'll drive to." },
                  ]
            }
          />
        )}
        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to haul"
            items={[
              { label: "Create your driver profile", done: Boolean(carrier.profile), href: "/carrier/verification" },
              { label: "Register a vehicle", done: carrier.vehicles.length > 0, href: "/carrier/vehicles" },
              { label: "Upload licence and ID", done: gaps.every((g) => !g.startsWith("Upload")), href: "/carrier/verification" },
              { label: "Pass verification", done: verified },
              { label: "Set your payout wallet", done: false, phase: 5 },
            ]}
          />
          <Card>
            <CardHeader eyebrow="Matching" title="Which loads you'll see" action={<Truck className="size-5 text-trade-300" aria-hidden="true" />} />
            <CardBody className="text-sm leading-relaxed text-trade-800">
              Only freight that fits your <strong>verified payload</strong>, your <strong>routes</strong> and your
              <strong> availability</strong>. Your bid is sealed: no one else sees your price, travel time or ranking.
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
