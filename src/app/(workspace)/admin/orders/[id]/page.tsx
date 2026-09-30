import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { OrderDetailView } from "@/features/commerce/components/order-detail";
import { getCommerceSettings, getOrder } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";
import { FreightPanel } from "@/features/freight/components/freight-panel";
import { getOrderFreight } from "@/features/freight/queries";
import { PaymentPanel } from "@/features/payments/components/payment-panel";
import { getOrderPayment, getPaymentMethods } from "@/features/payments/queries";
import { DeliveryPanel } from "@/features/delivery/components/delivery-panel";
import { getDeliverySettings, getOrderDelivery } from "@/features/delivery/queries";
import { DisputePanel } from "@/features/disputes/components/dispute-panel";
import { getOrderDisputes } from "@/features/disputes/queries";


export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("admin");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order) notFound();
  const [freight, payment, methods, delivery, deliverySettings, disputes] = await Promise.all([
    getOrderFreight(order.id),
    getOrderPayment(order.id, { withLedger: true }),
    getPaymentMethods(),
    getOrderDelivery(order.id),
    getDeliverySettings(),
    getOrderDisputes(order.id),
  ]);
  // The database treats an admin who is also this order's seller or buyer as that party.
  const mine = viewer.roles.includes("seller") ? await getMyBusiness() : null;
  const party = mine?.id === order.seller_business_id ? "seller" : order.buyer_id === viewer.id ? "buyer" : null;
  return (
    <OrderDetailView
      order={order}
      perspective={party ?? "admin"}
      backHref="/admin/orders"
      cancelWindowMinutes={settings.cancelWindowMinutes}
      freight={
        <FreightPanel
          perspective={party ?? "admin"}
          freight={freight}
          order={{ id: order.id, status: order.status, version: order.version, currency: order.currency, subtotal_minor: order.subtotal_minor, total_weight_g: order.total_weight_g, itemCount: order.item_count, pieces: order.items.reduce((n, i) => n + i.quantity, 0) }}
        />
      }
      payment={
        <PaymentPanel
          perspective={party ?? "admin"}
          payment={payment}
          methods={methods}
          buyerPhone={order.buyer_snapshot.phone ?? ""}
          order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }}
        />
      }
      delivery={<DeliveryPanel order={{ id: order.id, status: order.status }} perspective={party ?? "admin"} data={delivery} settings={deliverySettings} />}
      trust={<DisputePanel order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }} role={party ?? "admin"} disputes={disputes} />}
      notice={
        party ? (
          <Alert tone="info">You&apos;re the {party} on this order, so actions here act as the {party}. Admin cancellations are audited.</Alert>
        ) : (
          <Alert tone="info">Admin view. Cancelling needs a reason, is shown to both parties and is recorded in the audit log.</Alert>
        )
      }
    />
  );
}
