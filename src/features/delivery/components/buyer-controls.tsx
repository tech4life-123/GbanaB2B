"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Eye, EyeOff, KeyRound, RefreshCw, TimerReset, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { formatDeliveryCode } from "@/lib/trust/labels";
import { buyerConfirmDelivery, cancelUnpaidOrder, regenerateDeliveryCode, runSweepNow } from "../actions";

/**
 * The buyer's half of the handover. The code is hidden until they choose to
 * show it, so a screenshot over a shoulder doesn't leak it. Sharing it means
 * "I've checked the goods" — the copy says so.
 */
export function DeliveryCodeCard({
  orderId,
  code,
  locked,
  attempts,
  maxAttempts,
  canConfirm,
}: {
  orderId: string;
  code: string;
  locked: boolean;
  attempts: number;
  maxAttempts: number;
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Done." : "Something went wrong.") });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-trade-900">
          <KeyRound className="size-4 text-signal-700" aria-hidden="true" /> Your delivery code
        </p>
        <p className="mt-3 text-center font-mono text-4xl font-bold tracking-[0.25em] text-trade-900 tabular sm:text-5xl" aria-live="polite">
          {shown ? formatDeliveryCode(code) : "••• •••"}
        </p>
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShown((s) => !s)} icon={shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}>
            {shown ? "Hide code" : "Show code"}
          </Button>
        </div>
        <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-muted">
          Give this code to the carrier <strong className="text-trade-900">only after you&apos;ve checked the goods</strong>. Entering it releases your payment to the seller and carrier.
        </p>
      </div>

      {locked && (
        <Alert tone="warning" title="Code locked after too many wrong tries">
          {attempts >= maxAttempts ? `The carrier entered ${attempts} wrong codes.` : null} Make a new code, or confirm receipt here once the goods are checked.
        </Alert>
      )}
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canConfirm && (
          <Button variant="escrow" onClick={() => setConfirming(true)} icon={<CheckCheck className="size-4" aria-hidden="true" />}>
            Confirm I received the goods
          </Button>
        )}
        <Button variant="outline" loading={pending} onClick={() => run(() => regenerateDeliveryCode(orderId), () => setShown(true))} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
          Make a new code
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirm you received the goods?"
        description="Only confirm once you've checked them. Payment is released to the seller and carrier straight away and can't be taken back — if something is wrong, report a problem instead."
      >
        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Go back
          </Button>
          <Button variant="escrow" loading={pending} onClick={() => run(() => buyerConfirmDelivery(orderId), () => setConfirming(false))}>
            Yes, release payment
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Cancel an unpaid order (buyer or admin). Explains what happens to stock and the freight request. */
export function CancelUnpaidButton({ orderId, admin }: { orderId: string; admin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} icon={<XCircle className="size-4" aria-hidden="true" />} className="text-red-800 hover:border-red-300 hover:bg-red-50">
        Cancel this unpaid order
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel before payment?"
        description={`The stock goes back to the seller, the freight request is closed and any waiting payment request expires. ${admin ? "This is recorded in the audit log." : "You won't be charged."}`}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            start(async () => {
              const r = await cancelUnpaidOrder(orderId, reason);
              if (r.ok) {
                setOpen(false);
                router.refresh();
              } else setErr(r.message);
            });
          }}
        >
          <Field id="cancel-unpaid-reason" label="Reason" optional>
            <Textarea id="cancel-unpaid-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {err && <Alert tone="danger">{err}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep the order
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Cancel order
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Admin: run the nightly housekeeping now and say what it did. */
export function RunSweepButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        loading={pending}
        icon={<TimerReset className="size-4" aria-hidden="true" />}
        onClick={() =>
          start(async () => {
            const r = await runSweepNow();
            setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Done.") : r.message });
            if (r.ok) router.refresh();
          })
        }
      >
        Run housekeeping now
      </Button>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
    </div>
  );
}
