import { Clock, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { OrderActor, OrderStatus } from "@/lib/orders/state";
import { autoReleaseHoursLeft } from "@/lib/trust/labels";
import type { DeliverySettings, OrderDelivery } from "../queries";
import { CancelUnpaidButton, DeliveryCodeCard } from "./buyer-controls";
import { TrackingTimeline } from "./tracking";

const PRE_PAYMENT: OrderStatus[] = ["carrier_selected", "awaiting_payment"];
const CONFIRMATION: Record<string, string> = { buyer_code: "Confirmed by code", buyer: "Confirmed by buyer", auto: "Released automatically", admin: "Decided by GbanaB2B" };
const MOVING: OrderStatus[] = ["paid_escrow", "in_transit", "awaiting_confirmation", "delivered", "completed", "disputed", "refunded", "partially_refunded"];

/**
 * Delivery section of an order: who has the goods now, the tracking trail, and
 * (buyer only) the delivery code. Sellers and admins see tracking but never the code.
 */
export function DeliveryPanel({
  order,
  perspective,
  data,
  settings,
}: {
  order: { id: string; status: OrderStatus };
  perspective: OrderActor;
  data: OrderDelivery;
  settings: DeliverySettings;
}) {
  const { delivery, events, code } = data;
  const status = order.status;

  // Unpaid, carrier booked: offer cancelling (buyer/admin) — the sweep also does it after the window.
  if (PRE_PAYMENT.includes(status)) {
    if (perspective === "seller") return null;
    return (
      <Card>
        <CardHeader eyebrow="Delivery" title="Not dispatched yet" description={`Delivery starts once payment is held in escrow. Unpaid orders are cancelled automatically after ${settings.paymentWindowHours} hours.`} />
        <CardBody>
          <CancelUnpaidButton orderId={order.id} admin={perspective === "admin"} />
        </CardBody>
      </Card>
    );
  }

  if (!MOVING.includes(status) && events.length === 0) return null;

  const live = status === "in_transit" || status === "awaiting_confirmation";
  const arrived = delivery?.arrived_at && status === "awaiting_confirmation" ? delivery.arrived_at : null;

  return (
    <Card>
      <CardHeader
        eyebrow="Delivery"
        title={
          status === "paid_escrow"
            ? "Waiting for the carrier to collect"
            : status === "in_transit"
              ? "On the road"
              : status === "awaiting_confirmation"
                ? "The carrier has arrived"
                : status === "disputed"
                  ? "Delivery on hold"
                  : "Delivery record"
        }
        action={delivery?.confirmation_method ? <Badge tone="escrow">{CONFIRMATION[delivery.confirmation_method] ?? delivery.confirmation_method}</Badge> : undefined}
      />
      <CardBody className="space-y-5">
        {status === "paid_escrow" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Truck className="size-4 shrink-0 text-trade-400" aria-hidden="true" /> Payment is secured. The carrier collects the goods from the seller next.
          </p>
        )}

        {perspective === "buyer" && live && code && (
          <DeliveryCodeCard orderId={order.id} code={code.code} locked={code.locked} attempts={code.attempts} maxAttempts={settings.maxAttempts} canConfirm={status === "awaiting_confirmation" || status === "in_transit"} />
        )}

        {perspective !== "buyer" && status === "awaiting_confirmation" && (
          <Alert tone="info" title="Waiting for the buyer to check the goods">
            The buyer gives the carrier a code after checking the goods; you can&apos;t see or use it.
          </Alert>
        )}

        {arrived && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Clock className="size-4 shrink-0 text-trade-400" aria-hidden="true" />
            If nobody confirms or raises a problem, payment is released automatically in about {autoReleaseHoursLeft(arrived, settings.autoConfirmHours)} hours.
          </p>
        )}

        {events.length > 0 ? <TrackingTimeline events={events} /> : status !== "paid_escrow" && <p className="text-sm text-muted">No tracking updates yet.</p>}
      </CardBody>
    </Card>
  );
}
