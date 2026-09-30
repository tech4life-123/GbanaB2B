"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { BadgeCheck, Clock, Pencil, Trash2, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import { VEHICLE_CLASS, VEHICLE_TYPES, vehicleClassFor, type VehicleType } from "@/lib/freight";
import { deleteVehicle, saveVehicle, type CarrierFormState } from "../actions";
import type { VehicleRow } from "../queries";

export function VehicleForm({ vehicle, onSaved }: { vehicle?: VehicleRow; onSaved?: () => void }) {
  const [state, action, pending] = useActionState<CarrierFormState, FormData>(async (prev, fd) => {
    const r = await saveVehicle(vehicle?.id ?? null, prev, fd);
    if (r?.ok) onSaved?.();
    return r;
  }, null);
  const [payload, setPayload] = useState(vehicle ? String(vehicle.payload_kg) : "");
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.focus();
  }, [state]);
  const idp = vehicle?.id ?? "new";
  const kg = Number(payload);
  const cls = Number.isFinite(kg) && kg > 0 ? VEHICLE_CLASS[vehicleClassFor(kg)] : null;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
        {state?.ok && !onSaved && <Alert tone="success">{state.message}</Alert>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idp}-type`} label="Vehicle type" error={err("vehicle_type")}>
          <Select id={`${idp}-type`} name="vehicle_type" defaultValue={vehicle?.vehicle_type ?? "box_truck"}>
            {(Object.keys(VEHICLE_TYPES) as VehicleType[]).map((t) => (
              <option key={t} value={t}>
                {VEHICLE_TYPES[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${idp}-plate`} label="Plate number" error={err("plate_number")}>
          <Input id={`${idp}-plate`} name="plate_number" defaultValue={vehicle?.plate_number ?? ""} placeholder="e.g. LBR-A1234" className="font-mono uppercase" autoCapitalize="characters" required aria-invalid={Boolean(err("plate_number")) || undefined} aria-describedby={describedBy(`${idp}-plate`, { error: err("plate_number") })} />
        </Field>
        <Field
          id={`${idp}-payload`}
          label="Maximum load (kg)"
          hint={cls ? `${cls.label} carrier · ${cls.range}. You'll only see loads up to this weight.` : "The most it can safely carry."}
          error={err("payload_kg")}
        >
          <Input id={`${idp}-payload`} name="payload_kg" inputMode="numeric" value={payload} onChange={(e) => setPayload(e.target.value.replace(/\D/g, "").slice(0, 5))} className="font-mono" required aria-invalid={Boolean(err("payload_kg")) || undefined} aria-describedby={describedBy(`${idp}-payload`, { hint: true, error: err("payload_kg") })} />
        </Field>
        <Field id={`${idp}-volume`} label="Cargo space (m³)" optional hint="Helps match bulky loads." error={err("cargo_volume_m3")}>
          <Input id={`${idp}-volume`} name="cargo_volume_m3" inputMode="decimal" defaultValue={vehicle?.cargo_volume_m3 ?? ""} className="font-mono" aria-describedby={describedBy(`${idp}-volume`, { hint: true, error: err("cargo_volume_m3") })} />
        </Field>
        <Field id={`${idp}-make`} label="Make and model" optional error={err("make_model")}>
          <Input id={`${idp}-make`} name="make_model" defaultValue={vehicle?.make_model ?? ""} placeholder="e.g. Isuzu NPR" />
        </Field>
        <Field id={`${idp}-year`} label="Year" optional error={err("year")}>
          <Input id={`${idp}-year`} name="year" inputMode="numeric" defaultValue={vehicle?.year ?? ""} className="font-mono" maxLength={4} />
        </Field>
      </div>
      {vehicle && (
        <label className="flex items-center gap-2.5 text-sm text-trade-800">
          <input type="checkbox" name="is_active" defaultChecked={vehicle.is_active} className="size-4 accent-trade-900" />
          In service (switch off while it&apos;s in the garage)
        </label>
      )}
      {vehicle?.is_verified && (
        <p className="text-[0.8125rem] text-signal-800">Changing the plate, type, load or space sends this vehicle back for verification.</p>
      )}
      <Button type="submit" variant="secondary" loading={pending}>
        {vehicle ? "Save vehicle" : "Add vehicle"}
      </Button>
    </form>
  );
}

export function VehicleCard({ vehicle }: { vehicle: VehicleRow }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nf = new Intl.NumberFormat("en-US");
  const cls = vehicle.vehicle_class ?? vehicleClassFor(vehicle.payload_kg);

  return (
    <li className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-trade-900 text-signal-400">
          <Truck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="tabular font-mono font-bold text-trade-900">{vehicle.plate_number}</span>
            {vehicle.is_verified ? (
              <Badge tone="escrow">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified
              </Badge>
            ) : (
              <Badge tone="signal">
                <Clock className="size-3.5" aria-hidden="true" /> Awaiting check
              </Badge>
            )}
            {!vehicle.is_active && <Badge>Off the road</Badge>}
          </p>
          <p className="mt-1 text-sm text-trade-800">
            {VEHICLE_TYPES[vehicle.vehicle_type]}
            {vehicle.make_model && ` · ${vehicle.make_model}`}
            {vehicle.year && ` · ${vehicle.year}`}
          </p>
          <p className="tabular mt-0.5 font-mono text-xs text-muted">
            {nf.format(vehicle.payload_kg)} kg max · {VEHICLE_CLASS[cls].label}
            {vehicle.cargo_volume_m3 && ` · ${vehicle.cargo_volume_m3} m³`}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          <Pencil className="size-4" aria-hidden="true" /> {editing ? "Close" : "Edit"}
        </Button>
        {!vehicle.is_verified && (
          <Button size="sm" variant="ghost" className="text-muted hover:text-red-700" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-4 border-t border-line pt-4">
          <VehicleForm vehicle={vehicle} onSaved={() => setEditing(false)} />
        </div>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${vehicle.plate_number}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteVehicle(vehicle.id);
                  if (!r.ok) setError(r.message);
                  setConfirm(false);
                })
              }
            >
              Delete
            </Button>
          </>
        }
      />
    </li>
  );
}
