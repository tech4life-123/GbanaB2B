"use client";

import { useActionState, useId, useState } from "react";
import { RefreshCw, RotateCcw, Unlock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  adminBeginPayout,
  adminCheckPayment,
  adminFinishPayout,
  adminMarkRefund,
  adminRefundEscrow,
  adminReleaseEscrow,
  adminSetExchangeRate,
  type PaymentFormState,
} from "../actions";

type Run = (prev: PaymentFormState, fd: FormData) => Promise<PaymentFormState>;

/** A confirm dialog with a required written reason; closes itself when the database accepts it. */
function ReasonDialogButton({
  run,
  hidden,
  triggerLabel,
  icon,
  variant,
  title,
  description,
  field,
  confirmLabel,
  fieldLabel,
}: {
  run: Run;
  hidden: Record<string, string>;
  triggerLabel: string;
  icon: React.ReactNode;
  variant: "secondary" | "danger" | "outline";
  title: string;
  description: string;
  field: string;
  confirmLabel: string;
  fieldLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(async (prev, fd) => {
    const r = await run(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, null);
  const id = useId();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} icon={icon}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <form action={action} className="space-y-4">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Field id={id} label={fieldLabel}>
            <Textarea id={id} name={field} rows={3} maxLength={500} required minLength={3} />
          </Field>
          {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ReleaseEscrowButton({ orderId }: { orderId: string }) {
  return (
    <ReasonDialogButton
      run={adminReleaseEscrow}
      hidden={{ order_id: orderId }}
      triggerLabel="Release funds"
      icon={<Unlock className="size-4" aria-hidden="true" />}
      variant="secondary"
      title="Release escrow?"
      description="The seller and carrier become owed their shares and the order is completed. This is recorded in the audit log and can't be undone."
      field="note"
      fieldLabel="Why are you releasing these funds?"
      confirmLabel="Release funds"
    />
  );
}

export function RefundEscrowButton({ orderId }: { orderId: string }) {
  return (
    <ReasonDialogButton
      run={adminRefundEscrow}
      hidden={{ order_id: orderId }}
      triggerLabel="Refund buyer"
      icon={<RotateCcw className="size-4" aria-hidden="true" />}
      variant="danger"
      title="Refund the whole payment?"
      description="The full amount goes back to the buyer's number and the order is closed as refunded. Partial refunds arrive with disputes."
      field="reason"
      fieldLabel="Why are you refunding?"
      confirmLabel="Create refund"
    />
  );
}

/** Small inline result form used by the payout and refund rows. */
function InlineResult({ state }: { state: PaymentFormState }) {
  if (!state) return null;
  return <p className={state.ok ? "text-xs text-escrow-700" : "text-xs text-red-700"} role={state.ok ? "status" : "alert"}>{state.ok ? state.message : state.message}</p>;
}

export function PayoutControls({ payoutId, status, defaultPhone, providers }: { payoutId: string; status: "pending" | "initiated" | "paid" | "failed"; defaultPhone: string; providers: { id: string; label: string }[] }) {
  const [beginState, begin, beginning] = useActionState<PaymentFormState, FormData>(adminBeginPayout, null);
  const [finishState, finish, finishing] = useActionState<PaymentFormState, FormData>(adminFinishPayout, null);
  const phoneId = useId();
  const refId = useId();
  if (status === "paid") return null;
  if (status === "initiated") {
    return (
      <form action={finish} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="payout_id" value={payoutId} />
        <Field id={refId} label="Provider reference" className="w-44">
          <Input id={refId} name="ref" maxLength={200} className="font-mono" />
        </Field>
        <Button type="submit" name="success" value="yes" size="sm" variant="escrow" loading={finishing}>
          Mark paid
        </Button>
        <Button type="submit" name="success" value="no" size="sm" variant="outline" disabled={finishing}>
          Mark failed
        </Button>
        <InlineResult state={finishState} />
      </form>
    );
  }
  if (providers.length === 0) return <p className="text-xs text-muted">No payment method is switched on.</p>;
  return (
    <form action={begin} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="payout_id" value={payoutId} />
      <Field id={phoneId} label="Send to" className="w-44">
        <Input id={phoneId} name="msisdn" type="tel" defaultValue={defaultPhone} placeholder="+231…" className="font-mono" />
      </Field>
      <Select name="provider" aria-label="Payment method" wrapperClassName="w-44">
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" loading={beginning}>
        {status === "failed" ? "Retry payout" : "Start payout"}
      </Button>
      <InlineResult state={beginState} />
    </form>
  );
}

export function RefundControls({ refundId, orderId, status }: { refundId: string; orderId: string; status: "pending" | "paid" | "failed" }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(adminMarkRefund, null);
  const refId = useId();
  if (status === "paid") return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="refund_id" value={refundId} />
      <input type="hidden" name="order_id" value={orderId} />
      <Field id={refId} label="Provider reference" className="w-44">
        <Input id={refId} name="ref" maxLength={200} className="font-mono" />
      </Field>
      <Button type="submit" name="paid" value="yes" size="sm" variant="escrow" loading={pending}>
        Mark refunded
      </Button>
      {status === "pending" && (
        <Button type="submit" name="paid" value="no" size="sm" variant="outline" disabled={pending}>
          Mark failed
        </Button>
      )}
      <InlineResult state={state} />
    </form>
  );
}

export function CheckPaymentButton({ txnId }: { txnId: string }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(adminCheckPayment, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="txn_id" value={txnId} />
      <Button type="submit" size="sm" variant="outline" loading={pending} icon={<RefreshCw className="size-3.5" aria-hidden="true" />}>
        Ask provider
      </Button>
      <InlineResult state={state} />
    </form>
  );
}

export function ExchangeRateForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(adminSetExchangeRate, null);
  const rateId = useId();
  const noteId = useId();
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
      <Field id={rateId} label="1 USD equals (LRD)" error={err?.rate}>
        <Input id={rateId} name="rate" inputMode="decimal" defaultValue={current ?? ""} className="font-mono" required />
      </Field>
      <Field id={noteId} label="Where the rate comes from" optional>
        <Input id={noteId} name="note" maxLength={300} placeholder="e.g. Central Bank of Liberia, 30 Sep" />
      </Field>
      <Button type="submit" loading={pending}>
        Save rate
      </Button>
      <div className="sm:col-span-3">
        {state?.ok && <Alert tone="success">{state.message}</Alert>}
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      </div>
    </form>
  );
}
