"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, ShoppingCart } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { QuantityEstimator } from "@/features/marketplace/components/quantity-estimator";
import type { CurrencyCode } from "@/lib/money/currency";
import type { PriceTier } from "@/lib/pricing/tiers";
import { addToCart, type CommerceFormState } from "../actions";

/** Quantity + estimate + add-to-cart in one form, so the number the buyer tries is the number they order. */
export function AddToCartPanel({
  productId,
  tiers,
  currency,
  moq,
  unitLabel,
  unitWeightG,
  available,
  inCartQty,
}: {
  productId: string;
  tiers: PriceTier[];
  currency: CurrencyCode;
  moq: number;
  unitLabel: string;
  unitWeightG: number | null;
  available: number;
  inCartQty: number | null;
}) {
  const [state, action, pending] = useActionState<CommerceFormState, FormData>(addToCart, null);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.focus();
  }, [state]);
  const soldOut = available < moq;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="product_id" value={productId} />
      <QuantityEstimator
        tiers={tiers}
        currency={currency}
        moq={moq}
        unitLabel={unitLabel}
        unitWeightG={unitWeightG}
        available={available}
        inputName="quantity"
        initialQty={inCartQty ?? moq}
      />

      <div ref={msgRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {state?.ok && (
          <Alert
            tone="success"
            action={
              <Link href="/buyer/cart" className="inline-flex items-center gap-1 font-semibold text-escrow-800 underline-offset-2 hover:underline">
                Review cart and check out <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            {state.message}
          </Alert>
        )}
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={soldOut} icon={<ShoppingCart className="size-4" aria-hidden="true" />}>
          {soldOut ? "Not enough stock" : inCartQty ? "Update quantity in cart" : "Add to cart"}
        </Button>
        {inCartQty && !state && (
          <p className="text-center text-xs text-muted">
            {inCartQty.toLocaleString("en-US")} already in your{" "}
            <Link href="/buyer/cart" className="font-semibold text-trade-900 underline-offset-2 hover:underline">
              cart
            </Link>
            .
          </p>
        )}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <ShieldCheck className="size-3.5 text-escrow-600" aria-hidden="true" />
          The seller confirms stock before you pay. Payment is held in escrow until delivery.
        </p>
      </div>
    </form>
  );
}
