import type { Metadata } from "next";
import { FileCheck2, Truck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/feedback";
import { PrepareCard, SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Carrier workspace" };

const VERIFICATION_STATES = [
  { key: "PENDING", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "VERIFIED", label: "Verified" },
];

export default async function CarrierOverviewPage() {
  const viewer = await getViewer();
  const name = viewer?.profile?.display_name || viewer?.profile?.full_name;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Carrier workspace"
        title={`Welcome, ${firstName(name)}`}
        description="Get verified once, then bid on loads that fit your vehicle and routes."
      />

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="bg-manifest p-6 text-white">
            <p className="label-caps text-trade-300">Verification status</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone="navy" className="!bg-white/10 !ring-white/15">Not started</Badge>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-trade-200">
              You can&apos;t bid until the GbanaB2B team has checked your licence, ID and vehicle. This protects
              buyers — and it protects you from unverified competitors undercutting on price.
            </p>
            <ol className="mt-6 flex items-center gap-2 text-xs" aria-label="Verification steps">
              {VERIFICATION_STATES.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2">
                  {i > 0 && <span className="h-px w-4 bg-white/20" aria-hidden="true" />}
                  <span className="rounded-sm bg-white/5 px-2 py-1 font-medium text-trade-200 ring-1 ring-white/10">{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <CardBody className="flex flex-col justify-center gap-2 p-6">
            <p className="font-bold text-trade-900">Document upload opens in phase 4</p>
            <p className="text-sm leading-relaxed text-muted">
              Documents are stored privately and only reviewed by authorised administrators. They are never shown to
              buyers, sellers or other carriers.
            </p>
          </CardBody>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <PrepareCard
          eyebrow="Prepare now"
          title="Documents you'll need"
          icon={<FileCheck2 className="size-5" />}
          items={[
            { label: "Driver's licence", detail: "Valid and readable, front and back." },
            { label: "National ID or passport", detail: "Must match the name on your licence." },
            { label: "Vehicle details", detail: "Type, plate number and registration papers." },
            { label: "Maximum payload", detail: "What your vehicle can safely carry, in kilograms." },
            { label: "Routes you cover", detail: "Your base town and the counties you'll drive to." },
          ]}
        />
        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to haul"
            items={[
              { label: "Verify your phone number", done: Boolean(viewer?.phone) },
              { label: "Add your name", done: Boolean(viewer?.profile?.full_name) },
              { label: "Register your vehicle", done: false, phase: 4 },
              { label: "Pass verification", done: false, phase: 4 },
              { label: "Set your payout wallet", done: false, phase: 5 },
            ]}
          />
          <Card>
            <CardHeader eyebrow="Matching" title="Which loads you'll see" action={<Truck className="size-5 text-trade-300" aria-hidden="true" />} />
            <CardBody className="text-sm leading-relaxed text-trade-800">
              Only freight that fits your <strong>verified payload</strong>, your <strong>routes</strong> and your
              <strong> availability</strong>. Your bid is sealed: no one else sees your price, ETA or ranking.
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
