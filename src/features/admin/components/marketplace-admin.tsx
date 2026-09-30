"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { BusinessStatus, BusinessVerificationStatus, CategoryRow } from "@/lib/db/types";
import { VERIFICATION } from "@/features/marketplace/constants";
import { reviewBusiness, saveCategory, type AdminFormState } from "../marketplace-actions";

export function ReviewBusinessButton({
  business,
}: {
  business: { id: string; trading_name: string; verification_status: BusinessVerificationStatus; status: BusinessStatus; verification_note: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AdminFormState, FormData>(reviewBusiness, null);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Review
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Review ${business.trading_name}`} description="Changes are recorded in the audit log. Suspending a business pauses all its live listings.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="business_id" value={business.id} />
          <Field id={`v-${business.id}`} label="Verification">
            <Select id={`v-${business.id}`} name="verification" defaultValue={business.verification_status}>
              {Object.entries(VERIFICATION).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`s-${business.id}`} label="Account status">
            <Select id={`s-${business.id}`} name="status" defaultValue={business.status}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <Field id={`n-${business.id}`} label="Note to the business" optional hint="Required when rejecting. Shown to the seller.">
            <Textarea id={`n-${business.id}`} name="note" defaultValue={business.verification_note ?? ""} rows={3} maxLength={500} />
          </Field>
          {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {state?.ok ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" variant="secondary" loading={pending}>
              Save review
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function CategoryEditor({ category }: { category?: CategoryRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveCategory, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const idp = category?.id ?? "new";
  return (
    <>
      {category ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} icon={<Pencil className="size-3.5" aria-hidden="true" />}>
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden="true" />}>
          New category
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={category ? `Edit ${category.name}` : "New category"}>
        <form action={action} className="space-y-4">
          {category && <input type="hidden" name="id" value={category.id} />}
          <Field id={`name-${idp}`} label="Name" error={err("name")}>
            <Input id={`name-${idp}`} name="name" defaultValue={category?.name ?? ""} maxLength={60} required />
          </Field>
          <Field id={`slug-${idp}`} label="URL slug" hint={category ? "Slugs can't change — links depend on them." : "e.g. solar-kits"} error={err("slug")}>
            <Input id={`slug-${idp}`} name="slug" defaultValue={category?.slug ?? ""} readOnly={!!category} className="font-mono" maxLength={60} required />
          </Field>
          <Field id={`desc-${idp}`} label="Description" optional error={err("description")}>
            <Textarea id={`desc-${idp}`} name="description" defaultValue={category?.description ?? ""} rows={2} maxLength={300} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id={`sort-${idp}`} label="Sort order" error={err("sort_order")}>
              <Input id={`sort-${idp}`} name="sort_order" inputMode="numeric" defaultValue={category?.sort_order ?? 100} className="tabular font-mono" />
            </Field>
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-trade-900">
              <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="size-4 accent-trade-900" />
              Visible to buyers
            </label>
          </div>
          {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {state?.ok ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" variant="secondary" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
