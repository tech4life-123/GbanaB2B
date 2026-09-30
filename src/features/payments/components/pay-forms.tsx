"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { FlaskConical, Lock, Smartphone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import { payForOrder, simulateSandboxPayment, type PaymentFormState } from "../actions";

export interface MethodOption {
  id: string;
  label: string;
  isTest: boolean;
}

export function PayForm({ orderId, methods, totalLabel, defaultPhone, lastFailure }: { orderId: string; methods: MethodOption[]; totalLabel: string; defaultPhone: string; lastFailure?: string | null }) {
  // One reference per form: a double-tap or a retry of the same submission can't charge twice.
  // After a failure the next attempt gets a fresh reference.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(async (prev, fd) => {
    const r = await payForOrder(prev, fd);
    if (r && !r.ok) setKey(crypto.randomUUID());
    return r;
  }, null);
  const ids = { method: useId(), phone: useId() };
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const msgRef = useRef<HTMLDivElement>(null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const chosen = methods.find((m) => m.id === method);

  useEffect(() => {
    if (state && !state.ok) {
      msgRef.current?.focus();
    }
  }, [state]);

  if (methods.length === 0) {
    return (
      <Alert tone="warning" title="Payment isn't open yet">
        Mobile Money payments haven&apos;t been switched on for this platform. Your order and carrier are saved — you&apos;ll be able to pay here as soon as they are.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="key" value={key} />
      {lastFailure && <Alert tone="danger" title="Your last payment didn't go through">{lastFailure}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={ids.method} label="Pay with">
          <Select id={ids.method} name="provider" value={method} onChange={(e) => setMethod(e.target.value)}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={ids.phone} label="Mobile Money number" hint="You'll get an approval prompt on this phone." error={err("msisdn")}>
          <Input id={ids.phone} name="msisdn" type="tel" inputMode="tel" autoComplete="tel" defaultValue={defaultPhone} placeholder="+231 77 000 0000" className="font-mono" aria-invalid={Boolean(err("msisdn")) || undefined} aria-describedby={describedBy(ids.phone, { hint: true, error: err("msisdn") })} />
        </Field>
      </div>
      {chosen?.isTest && (
        <Alert tone="warning" title="Test payment — no real money">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="size-4" aria-hidden="true" /> This is the development provider. You&apos;ll approve it with a test button on the next screen.
          </span>
        </Alert>
      )}
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      </div>
      <Button type="submit" size="lg" loading={pending} icon={<Lock className="size-4" aria-hidden="true" />}>
        Pay {totalLabel} into escrow
      </Button>
      <p className="text-xs text-muted">Your money is held safely and only released to the seller and carrier after delivery is confirmed.</p>
    </form>
  );
}

/** Test provider only: plays the customer's decision through the real signed-webhook path. */
export function SandboxPanel({ txnId }: { txnId: string }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(simulateSandboxPayment, null);
  return (
    <form action={action} className="space-y-3 rounded-lg border border-dashed border-signal-300 bg-signal-50/60 p-4">
      <input type="hidden" name="txn_id" value={txnId} />
      <p className="flex items-center gap-2 text-sm font-bold text-signal-900">
        <FlaskConical className="size-4" aria-hidden="true" /> Test panel — you are playing the phone
      </p>
      <p className="text-sm text-signal-900">With a real provider this happens on the customer&apos;s phone and arrives here as a signed message. No money moves.</p>
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="outcome" value="SUCCEEDED" loading={pending} icon={<Smartphone className="size-4" aria-hidden="true" />}>
          Approve test payment
        </Button>
        <Button type="submit" name="outcome" value="FAILED" variant="outline" disabled={pending}>
          Decline
        </Button>
      </div>
    </form>
  );
}
