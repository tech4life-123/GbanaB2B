"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { EyeOff, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { formatEta, VEHICLE_TYPES, type VehicleType } from "@/lib/freight";
import type { CurrencyCode } from "@/lib/money/currency";
import { submitBid, withdrawBid, type CarrierFormState } from "../actions";

export interface BidVehicleOption {
  id: string;
  plate: string;
  type: VehicleType;
  payloadKg: number;
}

/** The carrier's one sealed bid on a load: create, revise or withdraw. */
export function BidForm({
  rfqId,
  currency,
  pickupDate,
  vehicles,
  existing,
}: {
  rfqId: string;
  currency: CurrencyCode;
  pickupDate: string;
  vehicles: BidVehicleOption[];
  existing: { id: string; status: string; amountMajor: string; etaHours: number; deliveryDate: string; vehicleId: string; note: string | null } | null;
}) {
  const [state, action, pending] = useActionState<CarrierFormState, FormData>(submitBid, null);
  const [eta, setEta] = useState(existing ? String(existing.etaHours) : "");
  const [withdrawing, startWithdraw] = useTransition();
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const ids = { amount: useId(), vehicle: useId(), eta: useId(), date: useId(), note: useId() };
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.focus();
  }, [state]);
  const live = existing?.status === "submitted";
  const etaN = Number(eta);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="rfq_id" value={rfqId} />
      <input type="hidden" name="currency" value={currency} />
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state?.ok && <Alert tone="success">{state.message}</Alert>}
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
        {withdrawMsg && <Alert tone="info">{withdrawMsg}</Alert>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={ids.amount} label={`Your price (${currency})`} hint="For the whole job, pickup to drop-off." error={err("amount")}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-muted">{currency}</span>
            <Input id={ids.amount} name="amount" inputMode="decimal" defaultValue={existing?.amountMajor ?? ""} className="pl-14 font-mono text-lg font-semibold" required aria-invalid={Boolean(err("amount")) || undefined} aria-describedby={describedBy(ids.amount, { hint: true, error: err("amount") })} />
          </div>
        </Field>
        <Field id={ids.vehicle} label="Vehicle" error={err("vehicle_id")}>
          <Select id={ids.vehicle} name="vehicle_id" defaultValue={existing?.vehicleId ?? vehicles[0]?.id}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} · {VEHICLE_TYPES[v.type]} · {v.payloadKg.toLocaleString("en-US")} kg
              </option>
            ))}
          </Select>
        </Field>
        <Field id={ids.eta} label="Travel time (hours)" hint={Number.isFinite(etaN) && etaN > 0 ? `≈ ${formatEta(etaN)} on the road` : "From pickup to drop-off."} error={err("eta_hours")}>
          <Input id={ids.eta} name="eta_hours" inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, "").slice(0, 3))} className="font-mono" required aria-invalid={Boolean(err("eta_hours")) || undefined} aria-describedby={describedBy(ids.eta, { hint: true, error: err("eta_hours") })} />
        </Field>
        <Field id={ids.date} label="Delivery date" error={err("delivery_date")}>
          <Input id={ids.date} name="delivery_date" type="date" min={pickupDate} defaultValue={existing?.deliveryDate ?? pickupDate} required aria-invalid={Boolean(err("delivery_date")) || undefined} />
        </Field>
        <Field id={ids.note} label="Note to the buyer" optional hint="e.g. loading help, tarpaulin, experience with this route." error={err("note")} className="sm:col-span-2">
          <Textarea id={ids.note} name="note" rows={2} maxLength={300} defaultValue={existing?.note ?? ""} aria-describedby={describedBy(ids.note, { hint: true })} />
        </Field>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={pending}>
          {live ? "Update my bid" : existing ? "Send bid again" : "Send sealed bid"}
        </Button>
        {live && (
          <Button
            variant="ghost"
            loading={withdrawing}
            icon={<Undo2 className="size-4" aria-hidden="true" />}
            onClick={() =>
              startWithdraw(async () => {
                const r = await withdrawBid(existing!.id, rfqId);
                setWithdrawMsg(r.ok ? "Bid withdrawn. You can bid again while the load is open." : r.message);
              })
            }
          >
            Withdraw
          </Button>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Sealed bid: only the buyer sees it. Other carriers never see your price, your name or how many bids there are — and you can&apos;t see theirs.
      </p>
    </form>
  );
}
