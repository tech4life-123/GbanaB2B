import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, Phone, Store, Trophy, User } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { BidForm } from "@/features/carrier/components/bid-form";
import { CargoFacts, formatDay, Route } from "@/features/carrier/components/load-bits";
import { getLoad, getMyCarrier } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { BID_STATUS, formatEta, RFQ_STATUS, timeLeft, vehicleFits } from "@/lib/freight";
import { formatMoney } from "@/lib/money/currency";

export const metadata: Metadata = { title: "Load" };

type Contact = { name?: string; phone?: string | null; town?: string; county?: string; address_line?: string | null; contact_name?: string; contact_phone?: string; street?: string | null; landmark?: string | null; buyer_name?: string };

export default async function LoadPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("carrier");
  const { id } = await params;
  const [data, carrier] = await Promise.all([getLoad(id, viewer.id), getMyCarrier(viewer.id)]);
  if (!data) notFound();
  const { load, bid, assignment } = data;
  const left = timeLeft(load.closes_at);
  const open = load.status === "open" && !left.closed;
  const fitting = carrier.vehicles
    .filter((v) => vehicleFits({ payloadKg: v.payload_kg, volumeM3: v.cargo_volume_m3, isActive: v.is_active, isVerified: v.is_verified }, { weightG: load.cargo_weight_g, volumeCm3: load.cargo_volume_cm3 }))
    .map((v) => ({ id: v.id, plate: v.plate_number, type: v.vehicle_type, payloadKg: v.payload_kg }));
  const canBid = open && carrier.profile?.verification_status === "verified" && fitting.length > 0 && (!bid || bid.status === "submitted" || bid.status === "withdrawn");
  const pickup = (assignment?.pickup_snapshot ?? {}) as Contact;
  const dropoff = (assignment?.dropoff_snapshot ?? {}) as Contact;

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/carrier/loads" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
        <ArrowLeft className="size-4" aria-hidden="true" /> Load board
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps text-signal-700">Freight request</p>
          <h1 className="tabular mt-1 font-mono text-2xl font-bold text-trade-900">{load.rfq_number}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={RFQ_STATUS[load.status].tone}>{RFQ_STATUS[load.status].label}</Badge>
            {load.status === "open" && (
              <span className={left.urgent ? "font-semibold text-signal-800" : undefined}>
                <Clock className="mr-1 inline size-3.5" aria-hidden="true" />
                {left.label}
              </span>
            )}
          </p>
        </div>
        {bid && (
          <div className="text-right">
            <p className="label-caps text-muted">Your bid</p>
            <p className="flex items-center justify-end gap-2">
              <Badge tone={BID_STATUS[bid.status].tone}>{BID_STATUS[bid.status].label}</Badge>
              <MoneyText value={{ amountMinor: bid.amount_minor, currency: bid.currency }} className="text-lg font-bold text-trade-900" />
            </p>
          </div>
        )}
      </div>

      {assignment && assignment.status === "active" && (
        <section aria-labelledby="won" className="overflow-hidden rounded-lg border border-escrow-200 bg-white shadow-card">
          <div className="flex items-center gap-3 bg-escrow-50 px-5 py-4">
            <Trophy className="size-6 text-escrow-600" aria-hidden="true" />
            <div>
              <h2 id="won" className="font-bold text-escrow-800">You won this job</h2>
              <p className="text-sm text-escrow-800/80">
                {formatMoney({ amountMinor: assignment.amount_minor, currency: assignment.currency })} · deliver by {formatDay(assignment.proposed_delivery_date)}. Payment is held in escrow before pickup and released after delivery is confirmed.
              </p>
            </div>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <ContactBlock icon={<Store className="size-4" />} title="Pick up from" name={pickup.name} phone={pickup.phone} lines={[pickup.address_line, `${pickup.town}, ${pickup.county}`]} />
            <ContactBlock icon={<User className="size-4" />} title="Deliver to" name={dropoff.contact_name} phone={dropoff.contact_phone} lines={[dropoff.buyer_name, dropoff.street, `${dropoff.town}, ${dropoff.county}`, dropoff.landmark ? `Near ${dropoff.landmark}` : null]} />
          </div>
        </section>
      )}
      {assignment?.status === "cancelled" && <Alert tone="danger" title="This job was cancelled">The order was cancelled after you were selected. No pickup is needed.</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-5">
              <Route from={{ town: load.pickup_town, county: load.pickup_county }} to={{ town: load.destination_town, county: load.destination_county }} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="label-caps text-muted">Pickup</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 font-semibold text-trade-900">
                    <CalendarDays className="size-3.5 text-trade-400" aria-hidden="true" /> {formatDay(load.pickup_date)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Wanted by</dt>
                  <dd className="mt-0.5 font-semibold text-trade-900">{load.preferred_delivery_date ? formatDay(load.preferred_delivery_date) : "Flexible"}</dd>
                </div>
                {load.pickup_area && (
                  <div className="col-span-2">
                    <dt className="label-caps text-muted">Pickup area</dt>
                    <dd className="mt-0.5 inline-flex items-center gap-1 text-trade-800">
                      <MapPin className="size-3.5 text-trade-400" aria-hidden="true" /> {load.pickup_area}
                    </dd>
                  </div>
                )}
                {load.destination_landmark && (
                  <div className="col-span-2">
                    <dt className="label-caps text-muted">Drop-off landmark</dt>
                    <dd className="mt-0.5 text-trade-800">{load.destination_landmark}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>
          <CargoFacts load={load} />
          <Card>
            <CardHeader title="Cargo" />
            <CardBody className="space-y-2 text-sm text-trade-800">
              <p>{load.cargo_summary}</p>
              {load.handling_notes && <p className="text-muted">Handling: {load.handling_notes}</p>}
              {load.special_instructions && <p className="rounded-md bg-canvas px-3 py-2">“{load.special_instructions}”</p>}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title={bid ? "Your sealed bid" : "Place a sealed bid"} description={bid && bid.status === "submitted" && open ? "You can revise or withdraw it until bidding closes." : undefined} />
          <CardBody>
            {canBid ? (
              <BidForm
                rfqId={load.id}
                currency={load.currency}
                pickupDate={load.pickup_date}
                vehicles={fitting}
                existing={
                  bid
                    ? {
                        id: bid.id,
                        status: bid.status,
                        amountMajor: formatMoney({ amountMinor: bid.amount_minor, currency: bid.currency }, { withCode: false }).replace(/,/g, ""),
                        etaHours: bid.eta_hours,
                        deliveryDate: bid.proposed_delivery_date,
                        vehicleId: bid.vehicle_id,
                        note: bid.note,
                      }
                    : null
                }
              />
            ) : bid ? (
              <dl className="space-y-2 text-sm">
                <Row label="Status">
                  <Badge tone={BID_STATUS[bid.status].tone}>{BID_STATUS[bid.status].label}</Badge>
                </Row>
                <Row label="Price">
                  <MoneyText value={{ amountMinor: bid.amount_minor, currency: bid.currency }} />
                </Row>
                <Row label="Travel time">{formatEta(bid.eta_hours)}</Row>
                <Row label="Delivery">{formatDay(bid.proposed_delivery_date)}</Row>
                {bid.status === "rejected" && <p className="pt-2 text-muted">The buyer chose another carrier. Keep an eye on the board for the next load.</p>}
              </dl>
            ) : (
              <p className="text-sm text-muted">
                {!open ? "Bidding on this load has closed." : fitting.length === 0 ? "None of your verified vehicles can carry this load." : "You can't bid on this load."}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-trade-900">{children}</dd>
    </div>
  );
}

function ContactBlock({ icon, title, name, phone, lines }: { icon: React.ReactNode; title: string; name?: string; phone?: string | null; lines: (string | null | undefined)[] }) {
  return (
    <div>
      <p className="label-caps flex items-center gap-1.5 text-muted">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      <p className="mt-1 font-bold text-trade-900">{name}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-sm text-trade-800">
          {l}
        </p>
      ))}
      {phone && (
        <a href={`tel:${phone}`} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 font-mono text-sm font-semibold text-trade-900 hover:bg-trade-50">
          <Phone className="size-3.5" aria-hidden="true" /> {phone}
        </a>
      )}
    </div>
  );
}
