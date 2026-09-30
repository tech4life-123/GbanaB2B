"use client";

import { useActionState, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea, describedBy } from "@/components/ui/field";
import type { OrderAction } from "@/lib/orders/state";
import { transitionOrder, type CommerceFormState } from "../actions";

/**
 * The next steps a party can take on an order. Every action confirms in a
 * dialog (and asks for a reason where the buyer deserves one); the database
 * re-checks the move and rejects stale pages via the order version.
 */
export function OrderActions({ orderId, version, actions }: { orderId: string; version: number; actions: OrderAction[] }) {
  const [open, setOpen] = useState<OrderAction | null>(null);
  const [state, formAction, pending] = useActionState<CommerceFormState, FormData>(async (prev, fd) => {
    const result = await transitionOrder(prev, fd);
    // Close the dialog after a successful move; the page re-renders with the new state.
    if (result?.ok) setOpen(null);
    return result;
  }, null);
  const reasonId = useId();

  if (actions.length === 0) return null;
  const forward = actions.filter((a) => a.to !== "cancelled");
  const cancel = actions.find((a) => a.to === "cancelled");

  return (
    <div className="space-y-3">
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state && !state.ok && !open && <Alert tone="danger">{state.message}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {forward.map((a, i) => (
          <Button key={a.to} variant={i === 0 ? "primary" : "secondary"} onClick={() => setOpen(a)} className="sm:min-w-44">
            {a.label}
          </Button>
        ))}
        {cancel && (
          <Button variant="outline" onClick={() => setOpen(cancel)} className="text-red-800 hover:border-red-300 hover:bg-red-50">
            {cancel.label}
          </Button>
        )}
      </div>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.confirmTitle ?? ""}
        description={open?.confirmBody}
      >
        {open && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="to" value={open.to} />
            <input type="hidden" name="version" value={version} />
            {open.to === "cancelled" && (
              <Field
                id={reasonId}
                label={open.needsReason ? "Reason for the buyer" : "Reason"}
                optional={!open.needsReason}
                hint={open.needsReason ? "Shown to the buyer on their order." : "Helps the seller understand."}
                error={state && !state.ok ? state.fieldErrors?.note : undefined}
              >
                <Textarea
                  id={reasonId}
                  name="note"
                  required={open.needsReason}
                  maxLength={500}
                  rows={3}
                  placeholder={open.needsReason ? "e.g. Out of stock until next shipment" : ""}
                  aria-describedby={describedBy(reasonId, { hint: true })}
                />
              </Field>
            )}
            {open.to === "confirmed" && (
              <Field id={reasonId} label="Message to the buyer" optional hint="e.g. when the goods will be ready.">
                <Textarea id={reasonId} name="note" maxLength={500} rows={2} aria-describedby={describedBy(reasonId, { hint: true })} />
              </Field>
            )}
            {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
            <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
              <Button variant="ghost" onClick={() => setOpen(null)} disabled={pending}>
                Go back
              </Button>
              <Button type="submit" variant={open.to === "cancelled" ? "danger" : "primary"} loading={pending}>
                {open.to === "cancelled" ? "Cancel order" : open.label}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
