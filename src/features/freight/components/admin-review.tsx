"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { BadgeCheck, ShieldOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import type { CarrierStatus } from "@/lib/freight";
import { adminReviewCarrier, adminVerifyVehicle, type FreightFormState } from "../actions";

const DECISIONS: Record<CarrierStatus, { to: CarrierStatus; label: string; variant: "primary" | "danger" | "secondary"; needsNote: boolean }[]> = {
  pending: [],
  under_review: [
    { to: "verified", label: "Approve carrier", variant: "primary", needsNote: false },
    { to: "rejected", label: "Ask for changes", variant: "secondary", needsNote: true },
  ],
  verified: [{ to: "suspended", label: "Suspend", variant: "danger", needsNote: true }],
  suspended: [
    { to: "verified", label: "Reinstate", variant: "primary", needsNote: false },
    { to: "rejected", label: "Reject", variant: "secondary", needsNote: true },
  ],
  rejected: [],
};

/** Human decision on a carrier. The database re-checks the move, requires a note where needed and audits it. */
export function CarrierDecision({ carrierId, status, name, hasVerifiedVehicle }: { carrierId: string; status: CarrierStatus; name: string; hasVerifiedVehicle: boolean }) {
  const [choice, setChoice] = useState<(typeof DECISIONS)[CarrierStatus][number] | null>(null);
  const [state, action, pending] = useActionState<FreightFormState, FormData>(async (prev, fd) => {
    const r = await adminReviewCarrier(prev, fd);
    if (r?.ok) setChoice(null);
    return r;
  }, null);
  const noteId = useId();
  const options = DECISIONS[status];
  if (options.length === 0) {
    return <p className="text-sm text-muted">{status === "pending" ? "Waiting for the carrier to submit." : "Waiting for the carrier to fix and resubmit."}</p>;
  }
  return (
    <div className="space-y-3">
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state && !state.ok && !choice && <Alert tone="danger">{state.message}</Alert>}
      {status === "under_review" && !hasVerifiedVehicle && <p className="text-sm text-signal-800">Verify at least one vehicle below before approving.</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o.to} variant={o.variant} onClick={() => setChoice(o)} disabled={o.to === "verified" && !hasVerifiedVehicle} icon={o.to === "verified" ? <BadgeCheck className="size-4" aria-hidden="true" /> : o.to === "suspended" ? <ShieldOff className="size-4" aria-hidden="true" /> : undefined}>
            {o.label}
          </Button>
        ))}
      </div>
      <Dialog
        open={choice !== null}
        onClose={() => setChoice(null)}
        title={choice ? `${choice.label}: ${name}?` : ""}
        description={choice?.to === "verified" ? "They'll be able to see and bid on loads that fit their verified vehicles and routes." : "The carrier sees your note. Any live bids are withdrawn."}
      >
        {choice && (
          <form action={action} className="space-y-4">
            <input type="hidden" name="carrier_id" value={carrierId} />
            <input type="hidden" name="status" value={choice.to} />
            <Field id={noteId} label={choice.needsNote ? "Note for the carrier" : "Note"} optional={!choice.needsNote} hint={choice.to === "verified" ? "e.g. what you checked." : "Say exactly what to fix or why."}>
              <Textarea id={noteId} name="note" rows={3} maxLength={500} required={choice.needsNote} />
            </Field>
            {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
            <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
              <Button variant="ghost" onClick={() => setChoice(null)}>
                Go back
              </Button>
              <Button type="submit" variant={choice.variant === "danger" ? "danger" : "primary"} loading={pending}>
                Confirm
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

export function VehicleVerifyToggle({ vehicleId, carrierId, verified }: { vehicleId: string; carrierId: string; verified: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={verified ? "outline" : "secondary"}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await adminVerifyVehicle(vehicleId, carrierId, !verified);
            if (!r.ok) setError(r.message);
          })
        }
      >
        {verified ? "Unverify" : "Verify vehicle"}
      </Button>
      {error && <span className="text-xs text-red-700" role="alert">{error}</span>}
    </div>
  );
}
