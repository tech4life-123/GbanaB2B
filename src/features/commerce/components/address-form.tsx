"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import { COUNTIES } from "@/features/marketplace/constants";
import { deleteAddress, makeDefaultAddress, saveAddress, type CommerceFormState } from "../actions";
import type { AddressRow } from "../queries";

export function AddressForm({
  address,
  next,
  defaults,
  submitLabel = "Save address",
  onSaved,
}: {
  address?: AddressRow;
  /** Where to go after saving (e.g. back to checkout). */
  next?: string;
  defaults?: { contact_name?: string; contact_phone?: string };
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState<CommerceFormState, FormData>(async (prev, fd) => {
    const r = await saveAddress(address?.id ?? null, prev, fd);
    if (r?.ok) onSaved?.();
    return r;
  }, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && !state.ok) msgRef.current?.focus();
  }, [state]);
  const idp = address?.id ?? "new";

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
        {state?.ok && state.message && !onSaved && <Alert tone="success">{state.message}</Alert>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idp}-label`} label="Name for this address" hint="e.g. Shop, Warehouse, Gbarnga branch" error={err("label")}>
          <Input id={`${idp}-label`} name="label" defaultValue={address?.label ?? ""} maxLength={40} required aria-invalid={Boolean(err("label")) || undefined} aria-describedby={describedBy(`${idp}-label`, { hint: true, error: err("label") })} />
        </Field>
        <Field id={`${idp}-contact`} label="Who receives the goods" error={err("contact_name")}>
          <Input id={`${idp}-contact`} name="contact_name" defaultValue={address?.contact_name ?? defaults?.contact_name ?? ""} autoComplete="name" required aria-invalid={Boolean(err("contact_name")) || undefined} aria-describedby={describedBy(`${idp}-contact`, { error: err("contact_name") })} />
        </Field>
        <Field id={`${idp}-phone`} label="Their phone number" hint="The driver calls this number on arrival." error={err("contact_phone")}>
          <Input id={`${idp}-phone`} name="contact_phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" defaultValue={address?.contact_phone ?? defaults?.contact_phone ?? ""} required aria-invalid={Boolean(err("contact_phone")) || undefined} aria-describedby={describedBy(`${idp}-phone`, { hint: true, error: err("contact_phone") })} />
        </Field>
        <Field id={`${idp}-county`} label="County" error={err("county")}>
          <Select id={`${idp}-county`} name="county" defaultValue={address?.county ?? "Montserrado"} aria-invalid={Boolean(err("county")) || undefined}>
            {COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${idp}-town`} label="Town or community" error={err("town")}>
          <Input id={`${idp}-town`} name="town" defaultValue={address?.town ?? ""} placeholder="e.g. Paynesville" required aria-invalid={Boolean(err("town")) || undefined} aria-describedby={describedBy(`${idp}-town`, { error: err("town") })} />
        </Field>
        <Field id={`${idp}-street`} label="Street or area" optional error={err("street")}>
          <Input id={`${idp}-street`} name="street" defaultValue={address?.street ?? ""} placeholder="e.g. ELWA Junction, Old Road" />
        </Field>
        <Field id={`${idp}-landmark`} label="Landmark" optional hint="What drivers should look for." error={err("landmark")} className="sm:col-span-2">
          <Input id={`${idp}-landmark`} name="landmark" defaultValue={address?.landmark ?? ""} placeholder="e.g. Opposite Total gas station, blue gate" aria-describedby={describedBy(`${idp}-landmark`, { hint: true })} />
        </Field>
      </div>
      {!address?.is_default && (
        <label className="flex items-center gap-2.5 text-sm text-trade-800">
          <input type="checkbox" name="is_default" className="size-4 accent-trade-900" defaultChecked={!address} />
          Use as my default delivery address
        </label>
      )}
      <Button type="submit" variant="secondary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** A saved address with edit / default / delete. */
export function AddressCard({ address }: { address: AddressRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      else setConfirming(false);
    });

  return (
    <li className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-trade-50 text-trade-600">
          <MapPin className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-trade-900">{address.label}</span>
            {address.is_default && <Badge tone="navy">Default</Badge>}
          </p>
          <p className="mt-1 text-sm text-trade-800">
            {address.contact_name} · <span className="tabular font-mono text-[0.8125rem]">{address.contact_phone}</span>
          </p>
          <p className="text-sm text-muted">
            {[address.street, address.town, `${address.county} County`].filter(Boolean).join(", ")}
          </p>
          {address.landmark && <p className="text-sm text-muted">Near {address.landmark}</p>}
        </div>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          <Pencil className="size-4" aria-hidden="true" /> {editing ? "Close" : "Edit"}
        </Button>
        {!address.is_default && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => makeDefaultAddress(address.id))}>
            <Star className="size-4" aria-hidden="true" /> Make default
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-muted hover:text-red-700" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden="true" /> Delete
        </Button>
      </div>
      {editing && (
        <div className="mt-4 border-t border-line pt-4">
          <AddressForm address={address} onSaved={() => setEditing(false)} />
        </div>
      )}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this address?"
        description="Orders already placed keep their delivery address."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={pending} onClick={() => run(() => deleteAddress(address.id))}>
              Delete
            </Button>
          </>
        }
      />
    </li>
  );
}
