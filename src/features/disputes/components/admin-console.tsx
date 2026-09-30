"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { FAULT_OPTIONS, RESOLUTION_OUTCOMES, type ResolutionOutcome } from "@/lib/trust/labels";
import { adminResolveDispute, adminStartReview, type DisputeFormState } from "../actions";

export function StartReviewButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {err && <Alert tone="danger">{err}</Alert>}
      <Button
        variant="secondary"
        loading={pending}
        icon={<Search className="size-4" aria-hidden="true" />}
        onClick={() =>
          start(async () => {
            const r = await adminStartReview(disputeId);
            if (r.ok) router.refresh();
            else setErr(r.message);
          })
        }
      >
        Start review
      </Button>
    </div>
  );
}

/**
 * The decision form. The consequence of each outcome is spelled out before
 * anyone presses the button; the database re-checks the amounts and the state.
 */
export function ResolveForm({
  disputeId,
  currency,
  subtotalMinor,
  freightMinor,
  requestedMinor,
}: {
  disputeId: string;
  currency: CurrencyCode;
  subtotalMinor: number;
  freightMinor: number;
  requestedMinor: number | null;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ResolutionOutcome | "">("");
  const [state, action, pending] = useActionState<DisputeFormState, FormData>(async (prev, fd) => {
    const r = await adminResolveDispute(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  const outcomeId = useId();
  const faultId = useId();
  const amountId = useId();
  const noteId = useId();
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const chosen = RESOLUTION_OUTCOMES.find((o) => o.value === outcome);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <input type="hidden" name="currency" value={currency} />
      <Field id={outcomeId} label="Decision" error={errors?.outcome} hint={chosen?.hint}>
        <Select id={outcomeId} name="outcome" required value={outcome} onChange={(e) => setOutcome(e.target.value as ResolutionOutcome)} aria-describedby={describedBy(outcomeId, { hint: chosen?.hint, error: errors?.outcome })}>
          <option value="" disabled>
            Choose…
          </option>
          {RESOLUTION_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      {outcome === "partial_refund" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={amountId}
            label={`Refund amount (${currency})`}
            hint={`Goods ${formatMoney({ amountMinor: subtotalMinor, currency })} · freight ${formatMoney({ amountMinor: freightMinor, currency })}${requestedMinor ? ` · buyer asked ${formatMoney({ amountMinor: requestedMinor, currency })}` : ""}`}
            error={errors?.refund_amount}
          >
            <Input id={amountId} name="refund_amount" inputMode="decimal" required placeholder="0.00" defaultValue={requestedMinor ? (requestedMinor / 10 ** CURRENCIES[currency].minorUnits).toFixed(CURRENCIES[currency].minorUnits) : ""} aria-describedby={describedBy(amountId, { error: errors?.refund_amount })} />
          </Field>
          <Field id={faultId} label="Paid from" hint="Seller: taken from the goods (the fee is recalculated). Carrier: taken from freight." error={errors?.fault}>
            <Select id={faultId} name="fault" required defaultValue="" aria-describedby={describedBy(faultId, { error: errors?.fault })}>
              <option value="" disabled>
                Choose…
              </option>
              <option value="seller">Seller&apos;s share</option>
              <option value="carrier">Carrier&apos;s share</option>
            </Select>
          </Field>
        </div>
      )}

      {(outcome === "refund" || outcome === "release" || outcome === "reject") && (
        <Field id={faultId} label="Who was at fault?" hint="Counts toward the trust record shown on their profile." error={errors?.fault}>
          <Select id={faultId} name="fault" defaultValue="none">
            {FAULT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field id={noteId} label="Explanation for both sides" hint="Shown to the buyer, seller and carrier. At least 10 characters." error={errors?.note}>
        <Textarea id={noteId} name="note" rows={4} required minLength={10} maxLength={1000} aria-describedby={describedBy(noteId, { error: errors?.note })} />
      </Field>

      {state && !state.ok && !errors && <Alert tone="danger">{state.message}</Alert>}
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      <Button type="submit" variant="primary" loading={pending} disabled={!outcome} icon={<Scale className="size-4" aria-hidden="true" />}>
        Record decision
      </Button>
      <p className="text-xs text-muted">Money moves immediately and can&apos;t be undone. The decision is written to the audit log.</p>
    </form>
  );
}
