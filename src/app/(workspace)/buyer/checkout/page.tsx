import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/feedback";
import { AddressForm } from "@/features/commerce/components/address-form";
import { CheckoutForm } from "@/features/commerce/components/checkout-form";
import { getMyCart, listMyAddresses } from "@/features/commerce/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";
import { formatWeight } from "@/lib/logistics/units";
import { summarizeCart } from "@/lib/orders/cart";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const viewer = await requireRole("buyer");
  const [lines, addresses] = await Promise.all([getMyCart(), listMyAddresses()]);
  const cart = summarizeCart(lines);
  if (cart.lineCount === 0) redirect("/buyer/cart");
  const business = viewer.roles.includes("seller") ? await getMyBusiness() : null;
  const nf = new Intl.NumberFormat("en-US");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link href="/buyer/cart" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-trade-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to cart
        </Link>
        <div className="mt-3">
          <PageHeader eyebrow="Procurement" title="Checkout" description="Choose where the goods go. Sellers confirm stock before anything is paid." />
        </div>
      </div>

      {cart.hasIssues && (
        <Alert tone="warning" title="Your cart needs attention" action={<Link href="/buyer/cart" className="font-semibold underline-offset-2 hover:underline">Fix cart</Link>}>
          Some quantities are below the minimum order, above available stock, or no longer available.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardBody className="py-5">
            {addresses.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-trade-900">Where should we deliver?</h2>
                  <p className="mt-0.5 text-sm text-muted">Save your first delivery address. You can add more later.</p>
                </div>
                <AddressForm
                  next="/buyer/checkout"
                  submitLabel="Save and continue"
                  defaults={{ contact_name: viewer.profile?.full_name ?? "", contact_phone: viewer.phone ?? "" }}
                />
              </div>
            ) : (
              <CheckoutForm addresses={addresses} orderCount={cart.groups.length} blocked={cart.hasIssues} defaultBusinessName={business?.trading_name} />
            )}
          </CardBody>
        </Card>

        <Card className="lg:sticky lg:top-6">
          <CardHeader title={cart.groups.length > 1 ? `${cart.groups.length} orders` : "Your order"} description="One order per seller and currency." />
          <CardBody className="divide-y divide-line py-0">
            {cart.groups.map((g) => (
              <div key={g.key} className="py-4">
                <p className="flex items-center gap-2 text-sm font-bold text-trade-900">
                  <Store className="size-4 text-trade-400" aria-hidden="true" /> {g.seller.name}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {g.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-trade-800">
                        {l.product!.title} <span className="tabular font-mono text-xs text-muted">× {nf.format(l.quantity)}</span>
                      </span>
                      {l.lineTotalMinor !== null && <MoneyText value={{ amountMinor: l.lineTotalMinor, currency: g.currency }} className="shrink-0 text-trade-900" />}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-line pt-2 text-sm">
                  <span className="tabular font-mono text-xs text-muted">{formatWeight(g.weightG)}</span>
                  <MoneyText value={{ amountMinor: g.subtotalMinor, currency: g.currency }} className="font-bold text-trade-900" />
                </div>
              </div>
            ))}
            <p className="py-3 text-xs text-muted">Freight is added later from carrier bids.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
