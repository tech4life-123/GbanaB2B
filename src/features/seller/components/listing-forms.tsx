"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { formatMoney, parseMajorToMinor, type CurrencyCode } from "@/lib/money/currency";
import { gramsToKgString, mmToCmString } from "@/lib/logistics/units";
import { buildTiers, tierRangeLabel, validateTiers } from "@/lib/pricing/tiers";
import type { CategoryRow, PackagingType } from "@/lib/db/types";
import { ORIGIN_COUNTRIES, PACKAGING } from "@/features/marketplace/constants";
import type { FormState } from "../actions";
import { FormMessage, fieldError } from "./form-bits";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/* ------------------------------------------------------------------ basics */

export interface BasicsValues {
  title: string;
  category_id: string;
  unit_label: string;
  packaging_type: PackagingType;
  description: string | null;
  sku: string | null;
  origin_country: string | null;
}

export function ListingBasicsForm({
  action,
  categories,
  values,
  submitLabel,
  primary = false,
}: {
  action: Action;
  categories: CategoryRow[];
  values?: Partial<BasicsValues>;
  submitLabel: string;
  /** Use the amber primary style when this is the only action on the page. */
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const err = (n: string) => fieldError(state, n);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field id="title" label="Product title" hint="Brand, product and size — what buyers search for." error={err("title")}>
        <Input id="title" name="title" defaultValue={values?.title ?? ""} maxLength={140} required placeholder="e.g. Royal Umbrella parboiled rice, 25 kg" aria-invalid={!!err("title") || undefined} aria-describedby={describedBy("title", { hint: true, error: err("title") })} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="category_id" label="Category" error={err("category_id")}>
          <Select id="category_id" name="category_id" defaultValue={values?.category_id ?? ""} required aria-invalid={!!err("category_id") || undefined}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.filter((c) => c.is_active || c.id === values?.category_id).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="packaging_type" label="Packaging" error={err("packaging_type")}>
          <Select id="packaging_type" name="packaging_type" defaultValue={values?.packaging_type ?? "bag"}>
            {Object.entries(PACKAGING).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="unit_label" label="What is one unit?" hint={'Your MOQ and prices count these, e.g. "25 kg bag" or "carton of 24".'} error={err("unit_label")} className="sm:col-span-2">
          <Input id="unit_label" name="unit_label" defaultValue={values?.unit_label ?? ""} maxLength={40} required placeholder="25 kg bag" aria-invalid={!!err("unit_label") || undefined} aria-describedby={describedBy("unit_label", { hint: true, error: err("unit_label") })} />
        </Field>
        <Field id="sku" label="Your reference / SKU" optional error={err("sku")}>
          <Input id="sku" name="sku" defaultValue={values?.sku ?? ""} maxLength={60} className="font-mono" aria-describedby={describedBy("sku", { error: err("sku") })} />
        </Field>
        <Field id="origin_country" label="Country of origin" optional error={err("origin_country")}>
          <Select id="origin_country" name="origin_country" defaultValue={values?.origin_country ?? ""}>
            <option value="">Not specified</option>
            {Object.entries(ORIGIN_COUNTRIES)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <Field id="description" label="Description" optional hint="Quality, grade, brand, shelf life — anything a buyer should know." error={err("description")}>
        <Textarea id="description" name="description" defaultValue={values?.description ?? ""} rows={5} maxLength={5000} aria-describedby={describedBy("description", { hint: true, error: err("description") })} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant={primary ? "primary" : "secondary"} loading={pending} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- pricing */

interface TierRow {
  key: number;
  maxQty: string;
  price: string;
}

export function PricingForm({
  action,
  initial,
}: {
  action: Action;
  initial: { currency: CurrencyCode; moq: number; quantityAvailable: number; tiers: { maxQty: number | null; unitPriceMinor: number }[] };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency);
  const [moq, setMoq] = useState(String(initial.moq));
  const [rows, setRows] = useState<TierRow[]>(() =>
    initial.tiers.length
      ? initial.tiers.map((t, i) => ({ key: i, maxQty: t.maxQty === null ? "" : String(t.maxQty), price: (t.unitPriceMinor / 100).toFixed(2) }))
      : [{ key: 0, maxQty: "", price: "" }],
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const moqNum = Number.parseInt(moq, 10);
  const parsed = useMemo(() => {
    const tierInputs = rows.map((r, i) => ({
      maxQty: i === rows.length - 1 ? null : Number.parseInt(r.maxQty, 10) || null,
      unitPriceMinor: parseMajorToMinor(r.price, currency) ?? 0,
    }));
    const tiers = Number.isFinite(moqNum) && moqNum > 0 ? buildTiers(moqNum, tierInputs) : [];
    const issues = tiers.length ? validateTiers(moqNum, tiers) : [{ index: null, message: "Enter the minimum order first." }];
    return { tierInputs, tiers, issues };
  }, [rows, moqNum, currency]);

  const update = (key: number, patch: Partial<TierRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addTier = () => {
    setRows((rs) => {
      // Give the current last tier a sensible upper bound before appending.
      const last = rs[rs.length - 1]!;
      const start = parsed.tiers[rs.length - 1]?.minQty ?? moqNum;
      const suggested = last.maxQty || String(Math.max(start, start * 5 - 1));
      return [...rs.slice(0, -1), { ...last, maxQty: suggested }, { key: nextKey, maxQty: "", price: "" }];
    });
    setNextKey((k) => k + 1);
  };
  const removeTier = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  const moqErr = fieldError(state, "moq");
  const qtyErr = fieldError(state, "quantity_available");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="tiers" value={JSON.stringify(parsed.tierInputs)} />

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="currency" label="Currency">
          <Select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
            <option value="USD">USD — US Dollar</option>
            <option value="LRD">LRD — Liberian Dollar</option>
          </Select>
        </Field>
        <Field id="moq" label="Minimum order" hint="In units." error={moqErr}>
          <Input id="moq" name="moq" inputMode="numeric" value={moq} onChange={(e) => setMoq(e.target.value.replace(/\D/g, "").slice(0, 7))} className="tabular font-mono" aria-invalid={!!moqErr || undefined} aria-describedby={describedBy("moq", { hint: true, error: moqErr })} />
        </Field>
        <Field id="quantity_available" label="Units in stock" error={qtyErr}>
          <Input id="quantity_available" name="quantity_available" inputMode="numeric" defaultValue={initial.quantityAvailable} className="tabular font-mono" aria-invalid={!!qtyErr || undefined} aria-describedby={describedBy("quantity_available", { error: qtyErr })} />
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-trade-900">Quantity price tiers</legend>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          Reward bigger orders. Each tier starts where the previous one ends; the last tier covers everything above.
        </p>
        <ol className="mt-3 space-y-2">
          {rows.map((r, i) => {
            const tier = parsed.tiers[i];
            const last = i === rows.length - 1;
            const issue = parsed.issues.find((x) => x.index === i);
            return (
              <li key={r.key} className={cn("rounded-lg border bg-white p-3", issue ? "border-red-300" : "border-line")}>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[7.5rem]">
                    <p className="label-caps !text-[0.625rem] text-muted">Tier {i + 1}</p>
                    <p className="tabular mt-1 font-mono text-sm font-semibold text-trade-900">{tier ? tierRangeLabel(tier) : "—"}</p>
                  </div>
                  {!last && (
                    <div className="w-28">
                      <label htmlFor={`tier-max-${r.key}`} className="block text-xs font-semibold text-trade-800">
                        Up to
                      </label>
                      <Input id={`tier-max-${r.key}`} inputMode="numeric" value={r.maxQty} onChange={(e) => update(r.key, { maxQty: e.target.value.replace(/\D/g, "").slice(0, 7) })} className="tabular mt-1 !h-10 font-mono" />
                    </div>
                  )}
                  <div className="w-36">
                    <label htmlFor={`tier-price-${r.key}`} className="block text-xs font-semibold text-trade-800">
                      Price per unit ({currency})
                    </label>
                    <Input id={`tier-price-${r.key}`} inputMode="decimal" value={r.price} placeholder="0.00" onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d.,]/g, "").slice(0, 14) })} className="tabular mt-1 !h-10 font-mono" />
                  </div>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeTier(r.key)} className="ml-auto grid size-10 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Remove tier ${i + 1}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {issue && <p className="mt-2 text-[0.8125rem] font-medium text-red-700">{issue.message}</p>}
              </li>
            );
          })}
        </ol>
        {rows.length < 10 && (
          <Button type="button" variant="ghost" size="sm" onClick={addTier} className="mt-2" icon={<Plus className="size-4" aria-hidden="true" />}>
            Add a tier
          </Button>
        )}
        {parsed.issues.some((x) => x.index === null) && (
          <p className="mt-2 text-[0.8125rem] font-medium text-red-700">{parsed.issues.find((x) => x.index === null)!.message}</p>
        )}
      </fieldset>

      {parsed.issues.length === 0 && parsed.tiers.length > 0 && (
        <p className="rounded-md bg-trade-50 px-3 py-2 text-[0.8125rem] text-trade-800">
          Buyers will see:{" "}
          {parsed.tiers.map((t, i) => (
            <span key={i} className="tabular font-mono">
              {i > 0 && " · "}
              {tierRangeLabel(t)} → {formatMoney({ amountMinor: t.unitPriceMinor, currency })}
            </span>
          ))}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending} disabled={parsed.issues.length > 0} className="w-full sm:w-auto">
          Save prices & stock
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- logistics */

export function LogisticsForm({
  action,
  initial,
}: {
  action: Action;
  initial: {
    unit_weight_g: number | null;
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    is_fragile: boolean;
    is_stackable: boolean;
    max_stack_layers: number | null;
    handling_notes: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [stackable, setStackable] = useState(initial.is_stackable);
  const err = (n: string) => fieldError(state, n);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field id="unit_weight_kg" label="Weight of one unit (kg)" hint="Gross weight including packaging. Needed to publish — freight is priced from it." error={err("unit_weight_kg")}>
        <Input id="unit_weight_kg" name="unit_weight_kg" inputMode="decimal" defaultValue={gramsToKgString(initial.unit_weight_g)} placeholder="25.3" className="tabular max-w-40 font-mono" aria-invalid={!!err("unit_weight_kg") || undefined} aria-describedby={describedBy("unit_weight_kg", { hint: true, error: err("unit_weight_kg") })} />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-trade-900">
          Size of one unit (cm) <span className="font-normal text-muted">(optional)</span>
        </legend>
        <div className="mt-1.5 grid max-w-md grid-cols-3 gap-2">
          {(["length", "width", "height"] as const).map((d) => (
            <div key={d}>
              <label htmlFor={`${d}_cm`} className="block text-xs text-muted capitalize">
                {d}
              </label>
              <Input id={`${d}_cm`} name={`${d}_cm`} inputMode="decimal" defaultValue={mmToCmString(initial[`${d}_mm`])} className="tabular mt-1 font-mono" />
            </div>
          ))}
        </div>
        {err("length_cm") && <p className="mt-1.5 text-[0.8125rem] font-medium text-red-700">{err("length_cm")}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input type="checkbox" name="is_fragile" defaultChecked={initial.is_fragile} className="mt-0.5 size-4 accent-trade-900" />
          <span>
            <span className="block text-sm font-semibold text-trade-900">Fragile</span>
            <span className="text-[0.8125rem] text-muted">Glass, electronics, eggs…</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input type="checkbox" name="is_stackable" checked={stackable} onChange={(e) => setStackable(e.target.checked)} className="mt-0.5 size-4 accent-trade-900" />
          <span>
            <span className="block text-sm font-semibold text-trade-900">Can be stacked</span>
            <span className="text-[0.8125rem] text-muted">Untick for items that crush.</span>
          </span>
        </label>
      </div>
      {stackable && (
        <Field id="max_stack_layers" label="Maximum stack height (layers)" optional error={err("max_stack_layers")}>
          <Input id="max_stack_layers" name="max_stack_layers" inputMode="numeric" defaultValue={initial.max_stack_layers ?? ""} className="tabular max-w-28 font-mono" aria-describedby={describedBy("max_stack_layers", { error: err("max_stack_layers") })} />
        </Field>
      )}
      <Field id="handling_notes" label="Handling instructions" optional error={err("handling_notes")}>
        <Textarea id="handling_notes" name="handling_notes" defaultValue={initial.handling_notes ?? ""} maxLength={500} rows={2} placeholder="Keep dry. Load upright." />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending} className="w-full sm:w-auto">
          Save shipping details
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- specs */

export function SpecsForm({ action, initial }: { action: Action; initial: { label: string; value: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [rows, setRows] = useState(() =>
    (initial.length ? initial : [{ label: "", value: "" }]).map((r, i) => ({ ...r, key: i })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <Input name="spec_label" defaultValue={r.label} placeholder="e.g. Grade" maxLength={60} aria-label={`Specification ${i + 1} name`} />
            <Input name="spec_value" defaultValue={r.value} placeholder="e.g. Premium, 5% broken" maxLength={200} aria-label={`Specification ${i + 1} value`} />
            <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="grid size-11 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Remove specification ${i + 1}`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rows.length < 30 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => {
              setRows((rs) => [...rs, { label: "", value: "", key: nextKey }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add specification
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="secondary" loading={pending} className="w-full sm:w-auto">
          Save specifications
        </Button>
      </div>
    </form>
  );
}
