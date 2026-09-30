"use client";

import { useId, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Select, Textarea, describedBy } from "@/components/ui/field";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { askBuyerAssistant, type BuyerAssistResult } from "../actions";
import { AdvisoryNote, AiLabel, RemainingNote, ResultSection } from "./ai-bits";
import { useAssistant } from "./use-assistant";

const EXAMPLES = ["200 bags of 25 kg rice for a shop in Gbarnga", "Cooking oil and sugar to restock a wholesale stall, weekly", "Cement and roofing sheets for a small build in Buchanan"];

export function BuyerAssistant({ disabled, maxChars }: { disabled: boolean; maxChars: number }) {
  const id = useId();
  const [need, setNeed] = useState("");
  const [currency, setCurrency] = useState("USD");
  const a = useAssistant<BuyerAssistResult>();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader eyebrow="Buyer assistant" title="What do you need to buy?" description="Describe it in your own words — quantity, where it's going, how often." />
        <CardBody className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              a.run(() => askBuyerAssistant({ need, currency }));
            }}
          >
            <Field id={`${id}-need`} label="Your need" hint={`Up to ${maxChars.toLocaleString("en-US")} characters.`}>
              <Textarea id={`${id}-need`} rows={4} value={need} maxLength={maxChars} onChange={(e) => setNeed(e.target.value)} aria-describedby={describedBy(`${id}-need`, { hint: true })} placeholder="e.g. 200 bags of 25 kg rice for my shop in Gbarnga" />
            </Field>
            <div className="flex flex-wrap gap-2" aria-label="Examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setNeed(ex)} className="rounded-full border border-line-strong bg-white px-3 py-1.5 text-left text-xs font-medium text-trade-700 hover:border-trade-400 hover:bg-trade-50">
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field id={`${id}-cur`} label="Show prices in" className="sm:w-44">
                <Select id={`${id}-cur`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">US dollars</option>
                  <option value="LRD">Liberian dollars</option>
                </Select>
              </Field>
              <Button type="submit" loading={a.pending} disabled={disabled || need.trim().length < 10} icon={<Sparkles className="size-4" aria-hidden="true" />}>
                Find what I need
              </Button>
            </div>
          </form>
          <AdvisoryNote />
          {a.error && <Alert tone="danger">{a.error}</Alert>}
          {a.remaining !== null && <RemainingNote remaining={a.remaining} />}
        </CardBody>
      </Card>

      {a.pending && <p className="text-sm text-muted" role="status">Thinking it through and checking the marketplace…</p>}

      {a.value && (
        <div className="animate-fade-in space-y-6" aria-live="polite">
          <Card>
            <CardHeader title="What I understood" action={<AiLabel>AI suggestion</AiLabel>} />
            <CardBody className="space-y-4">
              <p className="text-sm text-trade-800">{a.value.plan.summary}</p>
              <ResultSection title="Quantity and MOQ notes" items={a.value.plan.quantity_notes} />
              <ResultSection title="Worth asking the seller" items={a.value.plan.questions_for_seller} />
            </CardBody>
          </Card>

          {a.value.groups.map((g) => (
            <section key={g.query} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-trade-900">
                  <Search className="mr-1.5 inline size-4 text-muted" aria-hidden="true" />“{g.query}”
                  <span className="ml-2 text-sm font-medium text-muted">{g.total} in stock</span>
                </h3>
                {g.total > 0 && (
                  <ButtonLink variant="ghost" size="sm" href={`/buyer/marketplace?q=${encodeURIComponent(g.query)}&currency=${currency}`}>
                    See all
                  </ButtonLink>
                )}
              </div>
              {g.items.length === 0 ? (
                <EmptyState compact title="Nothing listed for this yet">Try a broader phrase, or check back as sellers add stock.</EmptyState>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {g.items.map((item) => (
                    <ProductCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          ))}
          <p className="text-xs text-muted">Products above are real, current listings found by searching the marketplace — the assistant only suggested the search words.</p>
        </div>
      )}
    </div>
  );
}
