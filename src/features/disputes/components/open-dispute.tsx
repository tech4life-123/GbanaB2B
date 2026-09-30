"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { DISPUTE_KIND, DISPUTE_KINDS } from "@/lib/trust/labels";
import type { CurrencyCode } from "@/lib/money/currency";
import { openDispute, type DisputeFormState } from "../actions";

/**
 * Raising a dispute freezes the money, so the dialog says so plainly and asks
 * for a specific description. Photos and video are added on the next screen.
 */
export function OpenDisputeButton({
  orderId,
  role,
  currency,
  totalLabel,
}: {
  orderId: string;
  role: "buyer" | "seller" | "carrier";
  currency: CurrencyCode;
  totalLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DisputeFormState, FormData>(openDispute, null);
  const kindId = useId();
  const descId = useId();
  const refundId = useId();

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/${role}/disputes/${state.data.id}`);
  }, [state, router, role]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} icon={<Gavel className="size-4" aria-hidden="true" />} className="text-red-800 hover:border-red-300 hover:bg-red-50">
        Report a problem
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Report a problem with this order"
        description="This freezes the payment in escrow until GbanaB2B reviews it. Nobody is paid or refunded while a dispute is open."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="currency" value={currency} />
          <Field id={kindId} label="What went wrong?" error={errors?.kind}>
            <Select id={kindId} name="kind" required defaultValue="" aria-describedby={describedBy(kindId, { error: errors?.kind })}>
              <option value="" disabled>
                Choose…
              </option>
              {DISPUTE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DISPUTE_KIND[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={descId} label="Describe the problem" hint="Be specific: what, how many, what you saw. You can add photos next." error={errors?.description}>
            <Textarea id={descId} name="description" rows={4} required minLength={10} maxLength={2000} aria-describedby={describedBy(descId, { error: errors?.description })} />
          </Field>
          {role === "buyer" && (
            <Field id={refundId} label={`Refund you're asking for (${currency})`} optional hint={`Leave blank to let us decide. The order total is ${totalLabel}.`} error={errors?.requested_refund}>
              <Input id={refundId} name="requested_refund" inputMode="decimal" placeholder="0.00" aria-describedby={describedBy(refundId, { error: errors?.requested_refund })} />
            </Field>
          )}
          {state && !state.ok && !errors && <Alert tone="danger">{state.message}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Open dispute
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
