"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, MapPin, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { placeOrders, type CommerceFormState } from "../actions";
import type { AddressRow } from "../queries";

export function CheckoutForm({
  addresses,
  orderCount,
  blocked,
  defaultBusinessName,
}: {
  addresses: AddressRow[];
  orderCount: number;
  blocked: boolean;
  defaultBusinessName?: string;
}) {
  const [state, action, pending] = useActionState<CommerceFormState, FormData>(placeOrders, null);
  const [selected, setSelected] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && !state.ok) msgRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 flex w-full items-center justify-between gap-3">
          <span className="text-base font-bold text-trade-900">Deliver to</span>
          <Link href="/buyer/addresses?next=/buyer/checkout" className="inline-flex items-center gap-1 text-sm font-semibold text-signal-700 hover:text-signal-800">
            <Plus className="size-4" aria-hidden="true" /> New address
          </Link>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <label
              key={a.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border bg-white p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-signal-500/40",
                selected === a.id ? "border-trade-900 ring-1 ring-trade-900" : "border-line hover:border-trade-300",
              )}
            >
              <input
                type="radio"
                name="address_id"
                value={a.id}
                checked={selected === a.id}
                onChange={() => setSelected(a.id)}
                className="mt-1 size-4 accent-trade-900"
              />
              <span className="min-w-0 text-sm">
                <span className="flex items-center gap-1.5 font-bold text-trade-900">
                  <MapPin className="size-3.5 text-trade-400" aria-hidden="true" />
                  {a.label}
                </span>
                <span className="mt-1 block text-trade-800">
                  {a.contact_name} · <span className="tabular font-mono text-[0.8125rem]">{a.contact_phone}</span>
                </span>
                <span className="block text-muted">
                  {a.town}, {a.county}
                  {a.landmark && ` · near ${a.landmark}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="business_name" label="Buying for (business name)" optional hint="Printed on the proforma invoice.">
          <Input id="business_name" name="business_name" maxLength={120} defaultValue={defaultBusinessName} autoComplete="organization" aria-describedby={describedBy("business_name", { hint: true })} />
        </Field>
        <Field id="note" label="Note to the seller" optional hint="Delivery times, packing requests…" className="sm:col-span-2">
          <Textarea id="note" name="note" maxLength={500} rows={3} aria-describedby={describedBy("note", { hint: true })} />
        </Field>
      </div>

      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state && !state.ok && (
          <Alert tone="danger" title="Your order wasn't placed">
            {state.message}
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full sm:w-auto sm:min-w-72" loading={pending} disabled={blocked || !selected}>
          {orderCount > 1 ? `Place ${orderCount} orders` : "Place order"}
        </Button>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Nothing is charged now. Each seller confirms stock and issues a proforma invoice; you pay into escrow only after a carrier is booked.
        </p>
      </div>
    </form>
  );
}
