"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import type { BusinessRow } from "@/lib/db/types";
import { BUSINESS_TYPES, COUNTIES, SELLER_BUSINESS_TYPES } from "@/features/marketplace/constants";
import { saveBusiness, type FormState } from "../actions";
import { FormMessage, fieldError } from "./form-bits";

function localPhone(e164: string | null | undefined) {
  return e164 ? e164.replace(/^\+231/, "0") : "";
}

export function BusinessForm({ business }: { business: BusinessRow | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBusiness, null);
  const err = (n: string) => fieldError(state, n);
  const creating = !business;

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <section className="grid gap-5 sm:grid-cols-2">
        <Field id="trading_name" label="Business name" hint="The name buyers know you by." error={err("trading_name")} className="sm:col-span-2">
          <Input id="trading_name" name="trading_name" defaultValue={business?.trading_name ?? ""} required maxLength={120} aria-invalid={!!err("trading_name") || undefined} aria-describedby={describedBy("trading_name", { hint: true, error: err("trading_name") })} />
        </Field>
        <Field id="business_type" label="What best describes you?" error={err("business_type")}>
          <Select id="business_type" name="business_type" defaultValue={business?.business_type ?? "wholesaler"} aria-invalid={!!err("business_type") || undefined}>
            {SELLER_BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPES[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="legal_name" label="Registered name" optional error={err("legal_name")}>
          <Input id="legal_name" name="legal_name" defaultValue={business?.legal_name ?? ""} maxLength={160} />
        </Field>
        <Field id="county" label="County" error={err("county")}>
          <Select id="county" name="county" defaultValue={business?.county ?? "Montserrado"} aria-invalid={!!err("county") || undefined}>
            {COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="town" label="Town or community" error={err("town")}>
          <Input id="town" name="town" defaultValue={business?.town ?? ""} placeholder="e.g. Waterside, Monrovia" maxLength={80} required aria-invalid={!!err("town") || undefined} aria-describedby={describedBy("town", { error: err("town") })} />
        </Field>
        <Field id="address_line" label="Street / landmark" optional hint="Helps carriers find your warehouse for pickups." error={err("address_line")} className="sm:col-span-2">
          <Input id="address_line" name="address_line" defaultValue={business?.address_line ?? ""} maxLength={200} aria-describedby={describedBy("address_line", { hint: true, error: err("address_line") })} />
        </Field>
        <Field id="description" label="About your business" optional hint="What you sell, brands you carry, where you deliver." error={err("description")} className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={business?.description ?? ""} maxLength={2000} rows={4} aria-describedby={describedBy("description", { hint: true, error: err("description") })} />
        </Field>
      </section>

      <section className="grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
        <Field id="contact_phone" label="Business phone" optional error={err("contact_phone")}>
          <Input id="contact_phone" name="contact_phone" type="tel" inputMode="tel" defaultValue={localPhone(business?.contact_phone)} placeholder="077 012 3456" className="tabular font-mono" aria-invalid={!!err("contact_phone") || undefined} aria-describedby={describedBy("contact_phone", { error: err("contact_phone") })} />
        </Field>
        <Field id="whatsapp_phone" label="WhatsApp number" optional error={err("whatsapp_phone")}>
          <Input id="whatsapp_phone" name="whatsapp_phone" type="tel" inputMode="tel" defaultValue={localPhone(business?.whatsapp_phone)} placeholder="088 012 3456" className="tabular font-mono" aria-invalid={!!err("whatsapp_phone") || undefined} aria-describedby={describedBy("whatsapp_phone", { error: err("whatsapp_phone") })} />
        </Field>
        <Field id="registration_number" label="Business registration no." optional hint="Speeds up verification by the GbanaB2B team." error={err("registration_number")} className="sm:col-span-2">
          <Input id="registration_number" name="registration_number" defaultValue={business?.registration_number ?? ""} maxLength={60} className="font-mono" aria-describedby={describedBy("registration_number", { hint: true, error: err("registration_number") })} />
        </Field>
      </section>

      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
          {creating ? "Create business" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
