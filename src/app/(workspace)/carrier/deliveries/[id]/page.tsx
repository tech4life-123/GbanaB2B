import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel, Store, User } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { ContactBlock } from "@/features/carrier/components/load-bits";
import { CarrierJobControls } from "@/features/delivery/components/carrier-controls";
import { STAGE_LABEL } from "@/features/delivery/components/job-list";
import { TrackingTimeline } from "@/features/delivery/components/tracking";
import { getCarrierJob, getDeliverySettings } from "@/features/delivery/queries";
import { OpenDisputeButton } from "@/features/disputes/components/open-dispute";
import { requireRole } from "@/lib/auth/session";
import { formatWeight } from "@/lib/logistics/units";
import { carrierStage } from "@/lib/trust/labels";

export const metadata: Metadata = { title: "Delivery" };

type Contact = { name?: string; phone?: string | null; town?: string; county?: string; address_line?: string | null; contact_name?: string; contact_phone?: string; street?: string | null; landmark?: string | null; buyer_name?: string };

export default async function CarrierJobPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("carrier");
  const { id } = await params;
  const [job, settings] = await Promise.all([getCarrierJob(id, viewer.id), getDeliverySettings()]);
  if (!job) notFound();
  const { assignment: a, delivery, events, rfq, liveDispute } = job;
  const stage = carrierStage(delivery);
  const pickup = (a.pickup_snapshot ?? {}) as Contact;
  const dropoff = (a.dropoff_snapshot ?? {}) as Contact;
  const lastCheckpoint = [...events].reverse().find((e) => e.kind === "checkpoint")?.created_at ?? null;
  const cancelled = a.status === "cancelled";
  const total = a.amount_minor;

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/carrier/deliveries" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
        <ArrowLeft className="size-4" aria-hidden="true" /> All deliveries
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps text-signal-700">Delivery job</p>
          <h1 className="tabular mt-1 font-mono text-2xl font-bold text-trade-900">{rfq?.rfq_number ?? "Delivery"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {cancelled ? <Badge tone="danger">Cancelled</Badge> : <Badge tone={STAGE_LABEL[stage].tone}>{STAGE_LABEL[stage].label}</Badge>}
            {liveDispute && <Badge tone="danger">Dispute open</Badge>}
            {rfq && <span>{rfq.package_count} {rfq.package_count === 1 ? "package" : "packages"} · {formatWeight(rfq.cargo_weight_g)}{rfq.is_fragile ? " · fragile" : ""}</span>}
          </p>
        </div>
        <p className="text-right">
          <span className="label-caps block text-muted">Your freight fee</span>
          <MoneyText value={{ amountMinor: total, currency: a.currency }} className="text-lg font-bold text-trade-900" />
        </p>
      </div>

      {cancelled && <Alert tone="danger" title="This job was cancelled">The order was cancelled. No pickup is needed.</Alert>}
      {liveDispute && (
        <Alert tone="warning" title="A dispute is open on this delivery">
          <Link href={`/carrier/disputes/${liveDispute.id}`} className="font-semibold underline">
            Read it and add your side ({liveDispute.dispute_number})
          </Link>
        </Alert>
      )}

      {!cancelled && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader eyebrow="Next step" title={stage === "awaiting_pickup" ? "Collect the goods" : stage === "in_transit" ? "Deliver to the buyer" : stage === "arrived" ? "Hand over and confirm" : "Done"} />
              <CardBody>
                <CarrierJobControls orderId={a.order_id} delivery={delivery} lastCheckpointAt={lastCheckpoint} checkpointMinSeconds={settings.checkpointMinSeconds} frozen={Boolean(liveDispute)} />
              </CardBody>
            </Card>
            {events.length > 0 && (
              <Card>
                <CardHeader title="Tracking" />
                <CardBody>
                  <TrackingTimeline events={events} />
                </CardBody>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardBody className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <ContactBlock icon={<Store className="size-4" />} title="Pick up from" name={pickup.name} phone={pickup.phone} lines={[pickup.address_line, `${pickup.town}, ${pickup.county}`]} />
                <ContactBlock icon={<User className="size-4" />} title="Deliver to" name={dropoff.contact_name} phone={dropoff.contact_phone} lines={[dropoff.buyer_name, dropoff.street, `${dropoff.town}, ${dropoff.county}`, dropoff.landmark ? `Near ${dropoff.landmark}` : null]} />
              </CardBody>
            </Card>
            {rfq && (
              <Card>
                <CardHeader title="Cargo" />
                <CardBody className="space-y-2 text-sm text-trade-800">
                  <p>{rfq.cargo_summary}</p>
                  {rfq.handling_notes && <p className="text-muted">Handling: {rfq.handling_notes}</p>}
                </CardBody>
              </Card>
            )}
            {!liveDispute && delivery && !delivery.completed_at && (
              <Card>
                <CardHeader title="Something wrong?" description="Goods refused, damaged or a problem with the seller or buyer. Raising a dispute pauses the payment." action={<Gavel className="size-5 text-trade-400" aria-hidden="true" />} />
                <CardBody>
                  <DisputeButton orderId={a.order_id} currency={a.currency} />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DisputeButton({ orderId, currency }: { orderId: string; currency: "USD" | "LRD" }) {
  // Carriers can't read the order total, so there's no refund request field for them (only buyers ask for a refund).
  return <OpenDisputeButton orderId={orderId} role="carrier" currency={currency} totalLabel="" />;
}
