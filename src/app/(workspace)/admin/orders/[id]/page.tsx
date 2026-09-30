import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { OrderDetailView } from "@/features/commerce/components/order-detail";
import { getCommerceSettings, getOrder } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("admin");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order) notFound();
  // The database treats an admin who is also this order's seller or buyer as that party.
  const mine = viewer.roles.includes("seller") ? await getMyBusiness() : null;
  const party = mine?.id === order.seller_business_id ? "seller" : order.buyer_id === viewer.id ? "buyer" : null;
  return (
    <OrderDetailView
      order={order}
      perspective={party ?? "admin"}
      backHref="/admin/orders"
      cancelWindowMinutes={settings.cancelWindowMinutes}
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
