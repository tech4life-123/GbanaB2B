import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("seller");
  const [{ id }, business] = await Promise.all([params, getMyBusiness()]);
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order || !business || order.seller_business_id !== business.id) notFound();
  const [freight, payment, methods, delivery, deliverySettings, disputes] = await Promise.all([
    getOrderFreight(order.id),
    getOrderPayment(order.id, { withLedger: false }),
    getPaymentMethods(),
    getOrderDelivery(order.id),
    getDeliverySettings(),
    getOrderDisputes(order.id),
  ]);
  return (
    <OrderDetailView
      order={order}
      perspective="seller"
      backHref="/seller/orders"
      cancelWindowMinutes={settings.cancelWindowMinutes}
      freight={
        <FreightPanel
          perspective="seller"
          freight={freight}
          order={{ id: order.id, status: order.status, version: order.version, currency: order.currency, subtotal_minor: order.subtotal_minor, total_weight_g: order.total_weight_g, itemCount: order.item_count, pieces: order.items.reduce((n, i) => n + i.quantity, 0) }}
        />
      }
      payment={
        <PaymentPanel
          perspective="seller"
          payment={payment}
          methods={methods}
          buyerPhone=""
          order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }}
        />
      }
      delivery={<DeliveryPanel order={{ id: order.id, status: order.status }} perspective="seller" data={delivery} settings={deliverySettings} />}
      trust={<DisputePanel order={{ id: order.id, status: order.status, currency: order.currency, total_minor: order.total_minor }} role="seller" disputes={disputes} />}
    />
  );
}
