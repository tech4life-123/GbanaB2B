import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { DocumentUploader, SubmitForReview } from "@/features/carrier/components/documents";
import { CarrierProfileForm } from "@/features/carrier/components/profile-form";
import { getMyCarrier } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_STATUS, onboardingGaps } from "@/lib/freight";

export const metadata: Metadata = { title: "Verification" };

export default async function CarrierVerificationPage() {
  const viewer = await requireRole("carrier");
  const { profile, vehicles, documents } = await getMyCarrier(viewer.id);
  const status = profile?.verification_status ?? "pending";
  const meta = CARRIER_STATUS[status];
  const gaps = onboardingGaps({
    hasProfile: Boolean(profile),
    activeVehicles: vehicles.filter((v) => v.is_active).length,
    documents: documents.map((d) => d.doc_type),
  });
  const canSubmit = status === "pending" || status === "rejected";
  const locked = status === "verified" || status === "suspended";

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="Profile & verification" description="Buyers only see carriers our team has checked. Do this once, then bid on loads that fit you." />

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-trade-50 text-trade-700">
            <BadgeCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="flex items-center gap-2 font-bold text-trade-900">
              Status <Badge tone={meta.tone}>{meta.label}</Badge>
            </p>
            <p className="text-sm text-muted">{meta.hint}</p>
          </div>
        </div>
        {status === "verified" && (
          <Link href="/carrier/loads" className="inline-flex items-center gap-1 text-sm font-semibold text-signal-700 hover:text-signal-800">
            Open load board <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {profile?.verification_note && (status === "rejected" || status === "suspended" || status === "under_review") && (
        <Alert tone={status === "under_review" ? "info" : "danger"} title={status === "under_review" ? "Note" : "What our team said"}>
          {profile.verification_note}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Step 1" title="Driver profile" />
            <CardBody>
              <CarrierProfileForm profile={profile} defaults={{ full_name: viewer.profile?.full_name ?? "", phone: viewer.phone ?? "" }} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Step 3" title="Documents" description="Driver's licence plus a national ID or passport. Vehicle papers help us verify your trucks faster." />
            <CardBody>
              {profile ? (
                <DocumentUploader carrierId={viewer.id} vehicles={vehicles.map((v) => ({ id: v.id, plate_number: v.plate_number }))} documents={documents} locked={locked} />
              ) : (
                <p className="text-sm text-muted">Save your driver profile first.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader eyebrow="Step 2" title="Vehicles" />
            <CardBody className="space-y-3">
              {vehicles.length === 0 ? (
                <p className="text-sm text-muted">No vehicles yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {vehicles.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        <Truck className="size-4 text-trade-400" aria-hidden="true" />
                        <span className="font-mono font-semibold text-trade-900">{v.plate_number}</span>
                        <span className="text-muted">{v.payload_kg.toLocaleString("en-US")} kg</span>
                      </span>
                      <Badge tone={v.is_verified ? "escrow" : "signal"}>{v.is_verified ? "Verified" : "Awaiting check"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/carrier/vehicles" className="inline-flex items-center gap-1 text-sm font-semibold text-signal-700 hover:text-signal-800">
                {vehicles.length ? "Manage vehicles" : "Add a vehicle"} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardBody>
          </Card>

          {canSubmit && (
            <Card>
              <CardHeader eyebrow="Step 4" title={status === "rejected" ? "Submit again" : "Submit for verification"} />
              <CardBody>
                <SubmitForReview gaps={gaps} />
              </CardBody>
            </Card>
          )}
          {status === "under_review" && (
            <Alert tone="info" title="Under review">
              You&apos;ll be able to bid as soon as our team approves you. You can still update your profile and vehicles meanwhile.
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
