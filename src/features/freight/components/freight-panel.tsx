import { BadgeCheck, CalendarDays, Clock, EyeOff, Phone, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { formatDay, Route } from "@/features/carrier/components/load-bits";
import { BID_STATUS, formatEta, RFQ_STATUS, timeLeft, VEHICLE_CLASS, VEHICLE_TYPES } from "@/lib/freight";
import { formatWeight } from "@/lib/logistics/units";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import type { OrderActor, OrderStatus } from "@/lib/orders/state";
import { TrustSummary } from "@/features/reviews/components/stars";
import type { TrustStats } from "@/features/reviews/queries";
import type { OrderFreight } from "../queries";
import { CancelFreightButton, RequestFreightForm, SelectBidButton } from "./freight-forms";

/**
 * Freight section of an order page. What each party sees:
 * buyer — request, compare every sealed bid, book one;
 * seller — request/cancel and the booked carrier, but not the bids;
 * admin — everything, read-only apart from cancelling.
 */
export function FreightPanel({
  order,
  freight,
  perspective,
  carrierTrust,
}: {
  carrierTrust?: Map<string, TrustStats>;
  order: { id: string; status: OrderStatus; version: number; currency: CurrencyCode; subtotal_minor: number; total_weight_g: number; itemCount: number; pieces: number };
  freight: OrderFreight;
  perspective: OrderActor;
}) {
  const { rfq, bids, assignment } = freight;
  const money = (m: number) => formatMoney({ amountMinor: m, currency: order.currency });

  if (assignment) {
    const c = assignment.carrier_snapshot as { name: string; phone: string; plate_number: string; vehicle_label: string; vehicle_class: keyof typeof VEHICLE_CLASS; payload_kg: number };
    return (
      <Card className="overflow-hidden">
        <CardHeader eyebrow="Freight" title="Carrier booked" description={`${rfq?.rfq_number ?? ""} · accepted sealed bid`} action={<Badge tone="escrow"><BadgeCheck className="size-3.5" aria-hidden="true" /> Verified carrier</Badge>} />
        <CardBody className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-trade-900 text-signal-400">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold text-trade-900">{c.name}</p>
              <p className="text-sm text-trade-800">
                {c.vehicle_label} · <span className="font-mono">{c.plate_number}</span>
              </p>
              <p className="text-xs text-muted">
                {VEHICLE_CLASS[c.vehicle_class]?.label} · up to {c.payload_kg.toLocaleString("en-US")} kg · {formatEta(assignment.eta_hours)} on the road · delivery {formatDay(assignment.proposed_delivery_date)}
              </p>
              <a href={`tel:${c.phone}`} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 font-mono text-sm font-semibold text-trade-900 hover:bg-trade-50">
                <Phone className="size-3.5" aria-hidden="true" /> {c.phone}
              </a>
            </div>
          </div>
          <div className="text-right">
            <p className="label-caps text-muted">Freight</p>
            <MoneyText value={{ amountMinor: assignment.amount_minor, currency: assignment.currency }} className="text-xl font-bold text-trade-900" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!rfq) {
    if (order.status !== "ready_for_freight" || perspective === "admin") return null;
    return (
      <Card>
        <CardHeader eyebrow="Freight" title="Get delivery quotes" description="Verified carriers covering this route send sealed bids. The buyer compares and books one." />
        <CardBody>
          <RequestFreightForm orderId={order.id} defaultPackages={order.pieces} cargoLabel={`${formatWeight(order.total_weight_g)} of cargo`} />
        </CardBody>
      </Card>
    );
  }

  const left = timeLeft(rfq.closes_at);
  const live = bids.filter((b) => b.status === "submitted");
  const cheapest = live[0]?.id;
  const fastest = [...live].sort((a, b) => a.eta_hours - b.eta_hours)[0]?.id;
  const canCancel = rfq.status === "open" && (perspective === "buyer" || perspective === "seller" || perspective === "admin");

  return (
    <Card>
      <CardHeader
        eyebrow={`Freight · ${rfq.rfq_number}`}
        title={perspective === "buyer" ? "Choose your carrier" : "Carriers are bidding"}
        action={canCancel ? <CancelFreightButton rfqId={rfq.id} orderId={order.id} needsReason={perspective === "admin"} /> : undefined}
      />
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <Route from={{ town: rfq.pickup_town, county: rfq.pickup_county }} to={{ town: rfq.destination_town, county: rfq.destination_county }} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
            <dt className="text-muted">Cargo</dt>
            <dd className="tabular font-mono font-semibold text-trade-900">{formatWeight(rfq.cargo_weight_g)}</dd>
            <dt className="text-muted">Pickup</dt>
            <dd className="font-semibold text-trade-900">{formatDay(rfq.pickup_date)}</dd>
            <dt className="text-muted">Bidding</dt>
            <dd className={left.urgent ? "font-semibold text-signal-800" : "font-semibold text-trade-900"}>
              <Badge tone={RFQ_STATUS[rfq.status].tone}>{left.closed && rfq.status === "open" ? "Closed" : RFQ_STATUS[rfq.status].label}</Badge>
            </dd>
          </dl>
        </div>

        {rfq.status === "open" && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" aria-hidden="true" />
            {left.closed ? "Bidding has closed — you can still book any live bid below." : `${left.label} for new bids.`}
          </p>
        )}

        {perspective === "seller" ? (
          <Alert tone="info">The buyer compares the sealed bids and books the carrier. You&apos;ll see the carrier and pickup date here once they do.</Alert>
        ) : bids.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-canvas px-4 py-8 text-center">
            <Truck className="mx-auto size-6 text-trade-300" aria-hidden="true" />
            <p className="mt-2 font-semibold text-trade-900">Waiting for bids</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Verified carriers whose routes and vehicles fit this load have been shown it. Bids appear here as they arrive.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {bids.map((b) => {
              const isLive = b.status === "submitted";
              return (
                <li key={b.id} className={isLive ? "rounded-lg border border-line bg-white p-4" : "rounded-lg border border-line bg-canvas p-4 opacity-70"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-trade-900">{b.carrier_name}</span>
                        <BadgeCheck className="size-4 text-escrow-600" aria-label="Verified carrier" />
                        {b.id === cheapest && live.length > 1 && <Badge tone="escrow">Lowest price</Badge>}
                        {b.id === fastest && live.length > 1 && fastest !== cheapest && <Badge tone="info">Fastest</Badge>}
                        {!isLive && <Badge tone={BID_STATUS[b.status].tone}>{BID_STATUS[b.status].label}</Badge>}
                      </p>
                      <p className="mt-0.5 text-sm text-trade-800">
                        {VEHICLE_TYPES[b.vehicle_type]} · {VEHICLE_CLASS[b.vehicle_class].label} · up to {b.payload_kg.toLocaleString("en-US")} kg
                      </p>
                      <TrustSummary stats={carrierTrust?.get(b.carrier_id) ?? null} className="mt-1 !text-xs" />
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" /> {formatEta(b.eta_hours)} on the road
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" aria-hidden="true" /> Delivers {formatDay(b.proposed_delivery_date)}
                        </span>
                      </p>
                      {b.note && <p className="mt-2 text-sm text-trade-800">“{b.note}”</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <MoneyText value={{ amountMinor: b.amount_minor, currency: b.currency }} className="text-lg font-bold text-trade-900" />
                      {perspective === "buyer" && isLive && rfq.status === "open" && (
                        <SelectBidButton
                          bidId={b.id}
                          orderId={order.id}
                          version={order.version}
                          carrierName={b.carrier_name}
                          priceLabel={money(b.amount_minor)}
                          totalLabel={money(order.subtotal_minor + b.amount_minor)}
                          primary={b.id === cheapest}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Bids are sealed: carriers can&apos;t see each other&apos;s prices, names or how many bids there are.
        </p>
      </CardBody>
    </Card>
  );
}
