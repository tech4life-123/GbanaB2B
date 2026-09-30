import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, PackageSearch, ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { TradePath } from "@/components/brand/trade-path";
import { SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { OrderList } from "@/features/commerce/components/order-bits";
import { countMyCart, countOrdersByStatus, listMyAddresses, listOrders } from "@/features/commerce/queries";
import { requireRole } from "@/lib/auth/session";
import { ORDER_GROUPS } from "@/lib/orders/state";

export const metadata: Metadata = { title: "Buyer workspace" };

export default async function BuyerOverviewPage() {
  const viewer = await requireRole("buyer");
  const name = viewer.profile?.display_name || viewer.profile?.full_name;
  const [cartCount, counts, recent, addresses] = await Promise.all([
    countMyCart(),
    countOrdersByStatus({ scope: "buyer", viewerId: viewer.id }),
    listOrders({ scope: "buyer", viewerId: viewer.id, statuses: ORDER_GROUPS.active, limit: 4 }),
    listMyAddresses(),
  ]);
  const sum = (keys: readonly string[]) => keys.reduce((n, k) => n + (counts[k as keyof typeof counts] ?? 0), 0);
  const totalOrders = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Buyer workspace"
        title={`Welcome, ${firstName(name)}`}
        description="Restock in bulk at locked prices, then track every order to your door."
        actions={
          cartCount > 0 ? (
            <ButtonLink href="/buyer/cart" icon={<ShoppingCart className="size-4" aria-hidden="true" />}>
              Cart · {cartCount}
            </ButtonLink>
          ) : (
            <ButtonLink href="/marketplace" icon={<PackageSearch className="size-4" aria-hidden="true" />}>
              Browse marketplace
            </ButtonLink>
          )
        }
      />

      <section aria-label="Order summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting seller" value={counts.pending_seller ?? 0} hint="Stock being checked" />
        <Stat label="Confirmed" value={sum(ORDER_GROUPS.progress)} hint="Invoice issued" />
        <Stat label="Ready for pickup" value={sum(ORDER_GROUPS.ready)} hint="Packed by the seller" />
        <Stat label="In cart" value={cartCount} hint={cartCount === 1 ? "product" : "products"} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section aria-labelledby="active-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 id="active-heading" className="text-base font-bold text-trade-900">
                Active orders
              </h2>
              {totalOrders > 0 && (
                <Link href="/buyer/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-trade-700 hover:text-trade-900">
                  All orders <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            {recent.length > 0 ? (
              <OrderList orders={recent} hrefBase="/buyer/orders" counterpart="seller" />
            ) : (
              <EmptyState compact icon={<ClipboardList className="size-5" />} title={totalOrders ? "No active orders" : "No orders yet"}>
                Find stock in the marketplace, add it to your cart at the minimum order quantity and check out. Each seller confirms before you pay.
              </EmptyState>
            )}
          </section>

          <Card>
            <CardHeader eyebrow="How buying works" title="From order to your shop floor" />
            <CardBody>
              <TradePath
                orientation="vertical"
                steps={[
                  { key: "1", title: "Order at locked prices", detail: "Tier price for your quantity, captured on a proforma invoice." },
                  { key: "2", title: "Pick a carrier", detail: "Verified carriers bid privately. Choose on price and ETA." },
                  { key: "3", title: "Pay into escrow", detail: "Your Mobile Money payment is held, not paid out.", escrow: true },
                  { key: "4", title: "Confirm delivery", detail: "Give the driver your 4-digit code only once the goods check out." },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to buy"
            items={[
              { label: "Verify your phone number", detail: "Your account and sign-in identity.", done: Boolean(viewer.phone || viewer.email) },
              { label: "Add your name", detail: "Used on invoices and orders.", done: Boolean(viewer.profile?.full_name) },
              { label: "Save a delivery address", detail: "Where carriers drop your stock.", done: addresses.length > 0, href: "/buyer/addresses" },
              { label: "Place your first order", detail: "Sellers confirm stock before you pay.", done: totalOrders > 0, href: "/marketplace" },
              { label: "Link a Mobile Money wallet", detail: "MTN MoMo or Orange Money.", done: false, phase: 5 },
            ]}
          />
          <div className="bg-manifest rounded-lg text-white shadow-card">
            <CardBody className="flex gap-4">
              <PackageSearch className="size-6 shrink-0 text-signal-400" aria-hidden="true" />
              <div>
                <p className="font-bold">Browse the marketplace</p>
                <p className="mt-1 text-sm leading-relaxed text-trade-200">
                  Search wholesale stock by category, minimum order quantity and price tier, from sellers across Liberia.
                </p>
                <Link href="/marketplace" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-signal-400 hover:text-signal-300">
                  Open marketplace <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </CardBody>
          </div>
        </div>
      </div>
    </div>
  );
}
