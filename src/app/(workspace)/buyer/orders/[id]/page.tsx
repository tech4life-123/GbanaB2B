import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { OrderDetailView } from "@/features/commerce/components/order-detail";
import { getCommerceSettings, getOrder } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order" };

export default async function BuyerOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const viewer = await requireRole("buyer");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order || order.buyer_id !== viewer.id) notFound();
  return (
    <OrderDetailView
      order={order}
      perspective="buyer"
      backHref="/buyer/orders"
      cancelWindowMinutes={settings.cancelWindowMinutes}
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
