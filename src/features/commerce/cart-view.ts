import { ISSUE_TEXT, type PricedLine } from "@/lib/orders/cart";
import type { CartLineView } from "./components/cart-line";

/** Serialisable shape for the client cart line. */
export function toCartLineView(l: PricedLine): CartLineView {
  return {
    id: l.id,
    quantity: l.quantity,
    issueText: l.issue ? ISSUE_TEXT[l.issue](l) : null,
    unitPriceMinor: l.unitPriceMinor,
    lineTotalMinor: l.lineTotalMinor,
    weightG: l.weightG,
    nextTier: l.nextTier,
    product: l.product
      ? {
          slug: l.product.slug,
          title: l.product.title,
          unitLabel: l.product.unitLabel,
          moq: l.product.moq,
          available: l.product.available,
          currency: l.product.currency,
          coverPath: l.product.coverPath,
        }
      : null,
  };
}

