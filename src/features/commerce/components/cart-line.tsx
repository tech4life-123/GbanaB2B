"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, PackageOpen, Trash2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/data";
import { formatWeight } from "@/lib/logistics/units";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { productImageUrl } from "@/lib/storage/images";
import { cn } from "@/lib/utils/cn";
import { removeCartLine, updateCartLine, type CommerceFormState } from "../actions";

export interface CartLineView {
  id: string;
  quantity: number;
  issueText: string | null;
  unitPriceMinor: number | null;
  lineTotalMinor: number | null;
  weightG: number;
  nextTier: { minQty: number; unitPriceMinor: number } | null;
  product: { slug: string; title: string; unitLabel: string; moq: number; available: number; currency: CurrencyCode; coverPath: string | null } | null;
}

export function CartLine({ line }: { line: CartLineView }) {
  const [qty, setQty] = useState(String(line.quantity));
  const [state, action, saving] = useActionState<CommerceFormState, FormData>(updateCartLine, null);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const p = line.product;
  const dirty = qty !== String(line.quantity);
  const nf = new Intl.NumberFormat("en-US");
  const src = productImageUrl(p?.coverPath);

  const remove = () =>
    startRemove(async () => {
      const r = await removeCartLine(line.id);
      if (!r.ok) setRemoveError(r.message);
    });

  return (
    <li className={cn("flex gap-3 p-4 sm:gap-4", removing && "opacity-50")}>
      <span className="relative size-16 shrink-0 overflow-hidden rounded-md border border-line bg-trade-50 sm:size-20">
        {src ? (
          <Image src={src} alt="" fill sizes="80px" quality={60} className="object-cover" />
        ) : (
          <PackageOpen className="absolute inset-0 m-auto size-6 text-trade-300" aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {p ? (
              <Link href={`/products/${p.slug}`} className="line-clamp-2 font-semibold text-trade-900 hover:underline">
                {p.title}
              </Link>
            ) : (
              <p className="font-semibold text-muted">Listing no longer available</p>
            )}
            {p && line.unitPriceMinor !== null && (
              <p className="tabular mt-0.5 font-mono text-xs text-muted">
                {formatMoney({ amountMinor: line.unitPriceMinor, currency: p.currency })} per {p.unitLabel} · {formatWeight(line.weightG)}
              </p>
            )}
          </div>
          {p && line.lineTotalMinor !== null && (
            <MoneyText value={{ amountMinor: line.lineTotalMinor, currency: p.currency }} className="shrink-0 text-sm font-semibold text-trade-900" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {p && (
            <form action={action} className="flex items-center gap-2">
              <input type="hidden" name="line_id" value={line.id} />
              <label htmlFor={`qty-${line.id}`} className="sr-only">
                Quantity of {p.title}
              </label>
              <input
                id={`qty-${line.id}`}
                name="quantity"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 7))}
                className="tabular h-9 w-24 rounded-md border border-line-strong bg-white px-2.5 font-mono text-sm font-semibold text-trade-900 focus:border-trade-700 focus:ring-3 focus:ring-signal-500/25 focus:outline-none"
                aria-describedby={line.issueText ? `issue-${line.id}` : undefined}
                aria-invalid={Boolean(line.issueText) || undefined}
              />
              {dirty && (
                <Button type="submit" size="sm" variant="secondary" loading={saving}>
                  Update
                </Button>
              )}
            </form>
          )}
          <Button size="sm" variant="ghost" onClick={remove} disabled={removing} className="text-muted hover:text-red-700">
            <Trash2 className="size-4" aria-hidden="true" /> Remove
          </Button>
        </div>

        {line.issueText && (
          <p id={`issue-${line.id}`} className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-red-700">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> {line.issueText}
          </p>
        )}
        {state && !state.ok && <p className="text-[0.8125rem] font-medium text-red-700" role="alert">{state.message}</p>}
        {removeError && <p className="text-[0.8125rem] font-medium text-red-700" role="alert">{removeError}</p>}
        {!line.issueText && p && line.nextTier && (
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-escrow-700">
            <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" />
            Order {nf.format(line.nextTier.minQty)}+ to pay {formatMoney({ amountMinor: line.nextTier.unitPriceMinor, currency: p.currency })} each
          </p>
        )}
      </div>
    </li>
  );
}
