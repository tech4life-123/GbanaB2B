import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { OrderDetailView } from "@/features/commerce/components/order-detail";
import { getCommerceSettings, getOrder } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";
import { FreightPanel } from "@/features/freight/components/freight-panel";
import { getOrderFreight } from "@/features/freight/queries";
import { PaymentPanel } from "@/features/payments/components/payment-panel";
import { getOrderPayment, getPaymentMethods } from "@/features/payments/queries";
import { DeliveryPanel } from "@/features/delivery/components/delivery-panel";
import { getDeliverySettings, getOrderDelivery } from "@/features/delivery/queries";
import { DisputePanel } from "@/features/disputes/components/dispute-panel";
import { getOrderDisputes } from "@/features/disputes/queries";
import { ReviewPanel } from "@/features/reviews/components/review-panel";
import { getOrderReviewStatus, getTrustStatsFor } from "@/features/reviews/queries";


export const metadata: Metadata = { title: "Order" };

export default async function BuyerOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const viewer = await requireRole("buyer");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order || order.buyer_id !== viewer.id) notFound();
  const [freight, payment, methods, delivery, deliverySettings, disputes, reviews] = await Promise.all([
    getOrderFreight(order.id),
    getOrderPayment(order.id, { withLedger: false }),
    getPaymentMethods(),
    getOrderDelivery(order.id, { withCode: true }),
    getDeliverySettings(),
    getOrderDisputes(order.id),
    getOrderReviewStatus(order.id),
  ]);
  const carrierTrust = await getTrustStatsFor("carrier", freight.bids.map((b) => b.carrier_id));
  const carrierName = (freight.assignment?.carrier_snapshot as { name?: string } | null)?.name ?? null;
  return (
    <OrderDetailView
      order={order}
      perspective="buyer"
      backHref="/buyer/orders"
      cancelWindowMinutes={settings.cancelWindowMinutes}
      freight={
        <FreightPanel
          perspective="buyer"
          freight={freight}
          carrierTrust={carrierTrust}
          order={{ id: order.id, status: order.status, version: order.version, currency: order.currency, subtotal_minor: order.subtotal_minor, total_weight_g: order.total_weight_g, itemCount: order.item_count, pieces: order.items.reduce((n, i) => n + i.quantity, 0) }}
        />
      }
      payment={
        <PaymentPanel
          perspective="buyer"
          payment={payment}
          methods={methods}
          buyerPhone={order.buyer_snapshot.phone ?? ""}
          order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }}
        />
      }
      delivery={<DeliveryPanel order={{ id: order.id, status: order.status }} perspective="buyer" data={delivery} settings={deliverySettings} />}
      trust={
        <>
          <DisputePanel order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }} role="buyer" disputes={disputes} />
          <ReviewPanel order={{ id: order.id, status: order.status }} done={reviews} sellerName={order.seller_snapshot.name} carrierName={carrierName} />
        </>
      }
      notice={
        sp.placed ? (
          <Alert tone="success" title="Order placed">
            {order.seller_snapshot.name} has been asked to confirm stock. Your proforma invoice appears here once they accept.
          </Alert>
        ) : undefined
      }
    />
  );
}
