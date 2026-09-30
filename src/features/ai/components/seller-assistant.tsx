"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea, describedBy } from "@/components/ui/field";
import { draftListing, type ListingDraftResult } from "../actions";
import { AdvisoryNote, AiLabel, CopyButton, RemainingNote, ResultSection } from "./ai-bits";
import { useAssistant } from "./use-assistant";

export function SellerAssistant({ disabled, maxChars }: { disabled: boolean; maxChars: number }) {
  const id = useId();
  const [notes, setNotes] = useState("");
  const a = useAssistant<ListingDraftResult>();
  const d = a.value?.draft;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader eyebrow="Listing assistant" title="Describe your product" description="Rough notes are fine: what it is, pack size, origin, brand, condition, how you sell it." />
        <CardBody className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              a.run(() => draftListing({ notes }));
            }}
          >
            <Field id={`${id}-notes`} label="Your notes" hint={`Up to ${maxChars.toLocaleString("en-US")} characters. Don't include phone numbers — they're removed anyway.`}>
              <Textarea id={`${id}-notes`} rows={5} value={notes} maxLength={maxChars} onChange={(e) => setNotes(e.target.value)} aria-describedby={describedBy(`${id}-notes`, { hint: true })} placeholder="e.g. Parboiled rice from Thailand, 25 kg woven bags, 40 bags per pallet, new stock, sell in pallets or single bags" />
            </Field>
            <Button type="submit" loading={a.pending} disabled={disabled || notes.trim().length < 10} icon={<Sparkles className="size-4" aria-hidden="true" />}>
              Draft my listing
            </Button>
          </form>
          <AdvisoryNote />
          {a.error && <Alert tone="danger">{a.error}</Alert>}
          {a.remaining !== null && <RemainingNote remaining={a.remaining} />}
        </CardBody>
      </Card>

      {a.pending && <p className="text-sm text-muted" role="status">Drafting…</p>}

      {d && a.value && (
        <Card className="animate-fade-in">
          <CardHeader title="Your draft" description="Nothing is saved or published. Copy what you like into the listing form, then check the price, MOQ and weights yourself." action={<AiLabel>AI draft</AiLabel>} />
          <CardBody className="space-y-5" aria-live="polite">
            <DraftField label="Title" value={d.title} />
            <DraftField label="Description" value={d.description} multiline />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted">Suggested category</p>
              {a.value.category ? <Badge tone="info">{a.value.category.name}</Badge> : <p className="text-sm text-muted">No clear match — choose it yourself in the form.</p>}
            </div>
            {d.specs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">Specifications</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {d.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3 border-b border-line py-1">
                      <dt className="text-muted">{s.label}</dt>
                      <dd className="font-medium text-trade-900">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <ResultSection title="Double-check before publishing" items={d.tips} tone="warn" />
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <ButtonLink href="/seller/listings/new" variant="secondary">
                Start a new listing
              </ButtonLink>
              <Link href="/seller/listings" className="inline-flex h-11 items-center px-3 text-sm font-semibold text-trade-800 underline">
                My listings
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DraftField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <CopyButton text={value} label={label.toLowerCase()} />
      </div>
      <p className={`rounded-md bg-canvas px-3 py-2 text-sm text-trade-900 ${multiline ? "whitespace-pre-wrap" : "font-semibold"} break-words`}>{value}</p>
    </div>
  );
}
