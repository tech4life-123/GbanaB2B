import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, ShoppingCart, Store } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { CartLine } from "@/features/commerce/components/cart-line";
import { getMyCart } from "@/features/commerce/queries";
import { carrierClassFor, formatWeight } from "@/lib/logistics/units";
import { summarizeCart } from "@/lib/orders/cart";
import { toCartLineView as toView } from "@/features/commerce/cart-view";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  await requireRole("buyer");
  const cart = summarizeCart(await getMyCart());

  if (cart.lineCount === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader eyebrow="Procurement" title="Cart" />
        <EmptyState
          icon={<ShoppingCart className="size-5" />}
          title="Your cart is empty"
          action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>}
        >
          Add wholesale products at their minimum order quantity. Products from different sellers become separate orders at checkout.
        </EmptyState>
      </div>
    );
  }

  const orderCount = cart.groups.length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="Cart"
        description={
          orderCount > 1
            ? `${cart.lineCount} products from ${orderCount} sellers — each seller gets their own order.`
            : `${cart.lineCount} ${cart.lineCount === 1 ? "product" : "products"} from ${cart.groups[0]?.seller.name ?? "one seller"}.`
        }
      />

      {cart.hasIssues && (
        <Alert tone="warning" title="Some lines need attention">
          Fix the quantities marked below, or remove products that are no longer available, before checking out.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          {cart.groups.map((g) => (
            <section key={g.key} aria-label={`Order from ${g.seller.name}`} className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Store className="size-4 shrink-0 text-trade-500" aria-hidden="true" />
                  <Link href={`/sellers/${g.seller.slug}`} className="truncate font-bold text-trade-900 hover:underline">
                    {g.seller.name}
                  </Link>
                  {g.seller.verified && <BadgeCheck className="size-4 shrink-0 text-escrow-600" aria-label="Verified business" />}
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <MapPin className="size-3.5" aria-hidden="true" /> Ships from {g.seller.town}, {g.seller.county}
                </span>
              </header>
              <ul className="divide-y divide-line">
                {g.lines.map((l) => (
                  <CartLine key={l.id} line={toView(l)} />
                ))}
              </ul>
              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
                <span className="tabular font-mono text-xs text-muted">
                  {formatWeight(g.weightG)} · {carrierClassFor(g.weightG)} carrier
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-muted">Subtotal</span>
                  <MoneyText value={{ amountMinor: g.subtotalMinor, currency: g.currency }} className="font-bold text-trade-900" />
                </span>
              </footer>
            </section>
          ))}

          {cart.unavailable.length > 0 && (
            <section aria-label="Unavailable products" className="overflow-hidden rounded-lg border border-red-200 bg-white">
              <ul className="divide-y divide-line">
                {cart.unavailable.map((l) => (
                  <CartLine key={l.id} line={toView(l)} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardBody className="space-y-4">
            <h2 className="text-base font-bold text-trade-900">Summary</h2>
            <dl className="space-y-2 text-sm">
              {cart.totals.map((t) => (
                <div key={t.currency} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Goods ({t.currency})</dt>
                  <dd>
                    <MoneyText value={{ amountMinor: t.subtotalMinor, currency: t.currency }} className="text-base font-bold text-trade-900" />
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Freight</dt>
                <dd className="text-muted">Quoted by carriers</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Orders to be placed</dt>
                <dd className="tabular font-mono font-semibold text-trade-900">{orderCount}</dd>
              </div>
            </dl>
            {cart.totals.length > 1 && (
              <p className="text-xs text-muted">USD and LRD listings are ordered separately and never added together.</p>
            )}
            {cart.hasIssues ? (
              <p className="rounded-md bg-signal-50 px-3 py-2 text-sm text-signal-800">Fix the marked lines to continue.</p>
            ) : (
              <ButtonLink href="/buyer/checkout" size="lg" className="w-full">
                Continue to checkout <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            )}
            <p className="text-xs leading-relaxed text-muted">Prices are checked again and locked when you place the order. Nothing is charged at checkout.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
