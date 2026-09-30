import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/features/commerce/components/order-detail";
import { getCommerceSettings, getOrder } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order" };

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("seller");
  const [{ id }, business] = await Promise.all([params, getMyBusiness()]);
  const [order, settings] = await Promise.all([getOrder(id), getCommerceSettings()]);
  if (!order || !business || order.seller_business_id !== business.id) notFound();
  return <OrderDetailView order={order} perspective="seller" backHref="/seller/orders" cancelWindowMinutes={settings.cancelWindowMinutes} />;
}
