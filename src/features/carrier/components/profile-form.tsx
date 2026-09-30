"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import { COUNTIES } from "@/features/marketplace/constants";
import { cn } from "@/lib/utils/cn";
import { saveCarrierProfile, type CarrierFormState } from "../actions";
import type { CarrierProfileRow } from "../queries";

export function CarrierProfileForm({
  profile,
  defaults,
}: {
  profile: CarrierProfileRow | null;
  defaults: { full_name?: string; phone?: string };
}) {
  const [state, action, pending] = useActionState<CarrierFormState, FormData>(saveCarrierProfile, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.focus();
  }, [state]);
  const coverage = new Set(profile?.coverage_counties ?? []);
  const verified = profile?.verification_status === "verified";

  return (
    <form action={action} className="space-y-5" noValidate>
      <div ref={msgRef} tabIndex={-1} className="outline-none">
        {state?.ok && <Alert tone="success">{state.message}</Alert>}
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Full name" hint={verified ? "Changing your name or phone sends your profile back for a quick re-check." : "As it appears on your licence."} error={err("full_name")}>
          <Input id="full_name" name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? defaults.full_name ?? ""} required aria-invalid={Boolean(err("full_name")) || undefined} aria-describedby={describedBy("full_name", { hint: true, error: err("full_name") })} />
        </Field>
        <Field id="phone" label="Phone" hint="Buyers and sellers call this number once you win a job." error={err("phone")}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" defaultValue={profile?.phone ?? defaults.phone ?? ""} required aria-invalid={Boolean(err("phone")) || undefined} aria-describedby={describedBy("phone", { hint: true, error: err("phone") })} />
        </Field>
        <Field id="address" label="Home address" error={err("address")} className="sm:col-span-2">
          <Input id="address" name="address" autoComplete="street-address" defaultValue={profile?.address ?? ""} required aria-invalid={Boolean(err("address")) || undefined} aria-describedby={describedBy("address", { error: err("address") })} />
        </Field>
        <Field id="home_county" label="Home county" error={err("home_county")}>
          <Select id="home_county" name="home_county" defaultValue={profile?.home_county ?? "Montserrado"}>
            {COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="home_town" label="Base town" hint="Where you usually start from." error={err("home_town")}>
          <Input id="home_town" name="home_town" defaultValue={profile?.home_town ?? ""} placeholder="e.g. Paynesville" required aria-invalid={Boolean(err("home_town")) || undefined} aria-describedby={describedBy("home_town", { hint: true, error: err("home_town") })} />
        </Field>
      </div>

      <fieldset aria-describedby="coverage-hint">
        <legend className="text-sm font-semibold text-trade-900">Counties you drive to</legend>
        <p id="coverage-hint" className="mt-0.5 text-[0.8125rem] text-muted">
          You only see loads where both pickup and delivery are in these counties.
        </p>
        {err("coverage_counties") && (
          <p className="mt-1 text-[0.8125rem] font-medium text-red-700" role="alert">
            {err("coverage_counties")}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COUNTIES.map((c) => (
            <label
              key={c}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-white px-3 text-sm text-trade-800",
                "has-[:checked]:border-trade-900 has-[:checked]:bg-trade-50 has-[:checked]:font-semibold has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-signal-500/40",
              )}
            >
              <input type="checkbox" name="coverage_counties" value={c} defaultChecked={coverage.has(c)} className="size-4 accent-trade-900" />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-md border border-line bg-canvas p-3 text-sm">
        <input type="checkbox" name="is_available" defaultChecked={profile?.is_available ?? true} className="mt-0.5 size-4 accent-trade-900" />
        <span>
          <span className="font-semibold text-trade-900">Available for new loads</span>
          <span className="block text-muted">Switch off when you&apos;re fully booked — new loads stop appearing until you switch back on.</span>
        </span>
      </label>

      <Button type="submit" variant="secondary" loading={pending}>
        {profile ? "Save profile" : "Create profile"}
      </Button>
    </form>
  );
}
