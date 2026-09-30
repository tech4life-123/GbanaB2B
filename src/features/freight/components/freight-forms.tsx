"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { cancelFreightRequest, requestFreight, selectBid, type FreightFormState } from "../actions";

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function RequestFreightForm({ orderId, defaultPackages, cargoLabel }: { orderId: string; defaultPackages: number; cargoLabel: string }) {
  const [state, action, pending] = useActionState<FreightFormState, FormData>(requestFreight, null);
  const ids = { pickup: useId(), deliver: useId(), packages: useId(), notes: useId() };
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const [pickup, setPickup] = useState(isoDay(1));
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && !state.ok) msgRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-sm text-trade-800">
        Carriers see the route, <span className="font-semibold">{cargoLabel}</span> and your dates — never your name or phone number until you book one.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={ids.pickup} label="Ready for pickup on" error={err("pickup_date")}>
          <Input id={ids.pickup} name="pickup_date" type="date" min={isoDay(0)} value={pickup} onChange={(e) => setPickup(e.target.value)} required aria-invalid={Boolean(err("pickup_date")) || undefined} />
        </Field>
        <Field id={ids.deliver} label="Deliver by" optional error={err("preferred_delivery_date")}>
          <Input id={ids.deliver} name="preferred_delivery_date" type="date" min={pickup} aria-invalid={Boolean(err("preferred_delivery_date")) || undefined} />
        </Field>
        <Field id={ids.packages} label="Pieces to load" hint="Bags, cartons, drums…" error={err("package_count")}>
          <Input id={ids.packages} name="package_count" inputMode="numeric" defaultValue={defaultPackages} className="font-mono" aria-describedby={describedBy(ids.packages, { hint: true, error: err("package_count") })} />
        </Field>
        <Field id={ids.notes} label="Instructions for carriers" optional hint="Loading dock, gate times, road conditions…" error={err("special_instructions")} className="sm:col-span-3">
          <Textarea id={ids.notes} name="special_instructions" rows={2} maxLength={500} aria-describedby={describedBy(ids.notes, { hint: true })} />
        </Field>
      </div>
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      </div>
      <Button type="submit" size="lg" loading={pending} icon={<Send className="size-4" aria-hidden="true" />}>
        Request freight quotes
      </Button>
    </form>
  );
}

export function CancelFreightButton({ rfqId, orderId, needsReason }: { rfqId: string; orderId: string; needsReason?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FreightFormState, FormData>(async (prev, fd) => {
    const r = await cancelFreightRequest(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, null);
  const id = useId();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted hover:text-red-700" onClick={() => setOpen(true)} icon={<X className="size-4" aria-hidden="true" />}>
        Cancel request
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancel this freight request?" description="All bids are closed. The order goes back to “ready for pickup” so you can request freight again.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="rfq_id" value={rfqId} />
          <input type="hidden" name="order_id" value={orderId} />
          <Field id={id} label="Reason" optional={!needsReason}>
            <Textarea id={id} name="reason" rows={2} maxLength={500} required={needsReason} />
          </Field>
          {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it open
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Cancel request
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Confirm-then-book for one bid. The dialog restates exactly what the buyer is committing to. */
export function SelectBidButton({
  bidId,
  orderId,
  version,
  carrierName,
  priceLabel,
  totalLabel,
  primary,
}: {
  bidId: string;
  orderId: string;
  version: number;
  carrierName: string;
  priceLabel: string;
  totalLabel: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FreightFormState, FormData>(async (prev, fd) => {
    const r = await selectBid(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, null);
  return (
    <>
      <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        Choose
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Book ${carrierName}?`} description="Other bids are closed and the carrier gets your pickup and delivery contacts.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="bid_id" value={bidId} />
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="version" value={version} />
          <dl className="space-y-1.5 rounded-md bg-canvas p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Freight</dt>
              <dd className="font-mono font-semibold text-trade-900">{priceLabel}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5">
              <dt className="text-muted">New order total</dt>
              <dd className="font-mono font-bold text-trade-900">{totalLabel}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted">A new proforma invoice is issued with the freight included. Payment into escrow comes next.</p>
          {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <Button type="submit" loading={pending}>
              Book carrier
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
