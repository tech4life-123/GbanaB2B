import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Lock, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataList } from "@/components/ui/data";
import { formatDate, formatDateTime } from "@/features/commerce/components/order-bits";
import { CarrierDecision, VehicleVerifyToggle } from "@/features/freight/components/admin-review";
import { getCarrierForAdmin } from "@/features/freight/queries";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_STATUS, DOCUMENT_TYPES, VEHICLE_CLASS, VEHICLE_TYPES } from "@/lib/freight";
import { SIGNED_URL_SECONDS } from "@/lib/storage/documents";

export const metadata: Metadata = { title: "Carrier review", robots: { index: false } };

export default async function AdminCarrierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const data = await getCarrierForAdmin(id);
  if (!data) notFound();
  const { profile: c, vehicles, documents, stats } = data;
  const meta = CARRIER_STATUS[c.verification_status];
  const docTypes = new Set(documents.map((d) => d.doc_type));

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/admin/verification" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
        <ArrowLeft className="size-4" aria-hidden="true" /> Carrier checks
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps text-signal-700">Carrier</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-trade-900">{c.full_name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {c.submitted_at && <span>Submitted {formatDateTime(c.submitted_at)}</span>}
          </p>
        </div>
      </div>

      {c.verification_note && <Alert tone="info" title="Last note">{c.verification_note}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Documents" description={`Private files. Links expire after ${SIGNED_URL_SECONDS / 60} minutes — reload the page for fresh ones.`} action={<Lock className="size-4 text-trade-300" aria-hidden="true" />} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone={docTypes.has("driver_license") ? "escrow" : "danger"}>Licence {docTypes.has("driver_license") ? "✓" : "missing"}</Badge>
                <Badge tone={docTypes.has("national_id") || docTypes.has("passport") ? "escrow" : "danger"}>ID / passport {docTypes.has("national_id") || docTypes.has("passport") ? "✓" : "missing"}</Badge>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-muted">No documents uploaded.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <FileText className="size-5 shrink-0 text-trade-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-trade-900">
                          {DOCUMENT_TYPES[d.doc_type].label}
                          {d.vehicle_id && <span className="font-mono text-xs font-normal text-muted"> · {vehicles.find((v) => v.id === d.vehicle_id)?.plate_number}</span>}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {d.file_name} · {Math.round(d.size_bytes / 1024)} KB · {formatDate(d.uploaded_at)}
                        </p>
                      </div>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-semibold text-trade-900 hover:bg-trade-50">
                          Open <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-red-700">Link unavailable</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicles" description="Check the plate and payload against the registration papers." />
            <ul className="divide-y divide-line">
              {vehicles.length === 0 && <li className="px-5 py-4 text-sm text-muted">No vehicles.</li>}
              {vehicles.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Truck className="size-5 shrink-0 text-trade-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-trade-900">{v.plate_number}</span>
                      <Badge tone={v.is_verified ? "escrow" : "signal"}>{v.is_verified ? "Verified" : "Unverified"}</Badge>
                      {!v.is_active && <Badge>Off the road</Badge>}
                    </p>
                    <p className="text-sm text-trade-800">
                      {VEHICLE_TYPES[v.vehicle_type]}
                      {v.make_model && ` · ${v.make_model}`}
                      {v.year && ` · ${v.year}`}
                    </p>
                    <p className="tabular font-mono text-xs text-muted">
                      {v.payload_kg.toLocaleString("en-US")} kg · {v.vehicle_class ? VEHICLE_CLASS[v.vehicle_class].label : ""}
                      {v.cargo_volume_m3 && ` · ${v.cargo_volume_m3} m³`}
                    </p>
                  </div>
                  <VehicleVerifyToggle vehicleId={v.id} carrierId={c.id} verified={v.is_verified} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Decision" />
            <CardBody>
              <CarrierDecision carrierId={c.id} status={c.verification_status} name={c.full_name} hasVerifiedVehicle={vehicles.some((v) => v.is_verified && v.is_active)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Profile" />
            <CardBody className="py-1">
              <DataList
                items={[
                  { label: "Phone", value: <span className="font-mono">{c.phone}</span> },
                  { label: "Address", value: c.address },
                  { label: "Base", value: `${c.home_town}, ${c.home_county}` },
                  { label: "Covers", value: c.coverage_counties.join(", ") },
                  { label: "Available", value: c.is_available ? "Yes" : "No" },
                  { label: "Bids / won", value: <span className="font-mono">{stats.bids} / {stats.won}</span> },
                  ...(c.verified_at ? [{ label: "Verified", value: formatDate(c.verified_at) }] : []),
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
