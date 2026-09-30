"use client";

import { useActionState, useId, useRef, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { addDisputeMessage, withdrawDispute, type DisputeFormState } from "../actions";

export function MessageForm({ disputeId }: { disputeId: string }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<DisputeFormState, FormData>(addDisputeMessage, null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <Field id={id} label="Add a message" hint="Everyone in this dispute, and GbanaB2B, can read it." error={state && !state.ok ? state.fieldErrors?.body : undefined}>
        <Textarea id={id} name="body" rows={3} required maxLength={2000} />
      </Field>
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" variant="secondary" loading={pending} icon={<Send className="size-4" aria-hidden="true" />}>
        Send
      </Button>
    </form>
  );
}

/** Only the person who opened the dispute can withdraw it; the order resumes where it was. */
export function WithdrawButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} icon={<Undo2 className="size-4" aria-hidden="true" />}>
        Withdraw dispute
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Withdraw this dispute?" description="The order goes back to where it was and the payment stays in escrow until delivery is confirmed.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            start(async () => {
              const r = await withdrawDispute(disputeId, note);
              if (r.ok) {
                setOpen(false);
                router.refresh();
              } else setErr(r.message);
            });
          }}
        >
          <Field id="withdraw-note" label="Note" optional>
            <Textarea id="withdraw-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {err && <Alert tone="danger">{err}</Alert>}
          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it open
            </Button>
            <Button type="submit" variant="secondary" loading={pending}>
              Withdraw
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
