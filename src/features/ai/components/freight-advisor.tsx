"use client";

import { useId, useState } from "react";
import { Sparkles, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { COUNTIES } from "@/features/marketplace/constants";
import { adviseFreight, type FreightAdviceResult } from "../actions";
import { AdvisoryNote, AiLabel, RemainingNote, ResultSection } from "./ai-bits";
import { useAssistant } from "./use-assistant";

/** Vehicle class comes from the platform's weight bands (not the AI); the AI adds packing and handover tips. */
export function FreightAdvisor({ disabled }: { disabled: boolean }) {
  const id = useId();
  const [goods, setGoods] = useState("");
  const [weight, setWeight] = useState("");
  const [packages, setPackages] = useState("1");
  const [from, setFrom] = useState("Montserrado");
  const [to, setTo] = useState("Nimba");
  const [fragile, setFragile] = useState(false);
  const a = useAssistant<FreightAdviceResult>();

  return (
    <Card>
      <CardHeader eyebrow="Freight assistant" title="Plan a delivery" description="Get the vehicle class and practical packing and handover tips before you post a freight request." />
      <CardBody className="space-y-4">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(() => adviseFreight({ goods, weight_kg: weight, packages, from, to, fragile }));
          }}
        >
          <Field id={`${id}-goods`} label="What are you shipping?" className="sm:col-span-2">
            <Input id={`${id}-goods`} value={goods} maxLength={400} onChange={(e) => setGoods(e.target.value)} placeholder="e.g. 40 bags of rice" />
          </Field>
          <Field id={`${id}-w`} label="Total weight (kg)">
            <Input id={`${id}-w`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1000" />
          </Field>
          <Field id={`${id}-p`} label="Packages">
            <Input id={`${id}-p`} inputMode="numeric" value={packages} onChange={(e) => setPackages(e.target.value)} />
          </Field>
          <Field id={`${id}-f`} label="Pickup county">
            <Select id={`${id}-f`} value={from} onChange={(e) => setFrom(e.target.value)}>
              {COUNTIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field id={`${id}-t`} label="Delivery county">
            <Select id={`${id}-t`} value={to} onChange={(e) => setTo(e.target.value)}>
              {COUNTIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-trade-800 sm:col-span-2">
            <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} className="size-4 accent-trade-900" />
            Fragile or easily damaged
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" loading={a.pending} disabled={disabled || goods.trim().length < 3 || !weight.trim()} icon={<Sparkles className="size-4" aria-hidden="true" />}>
              Get advice
            </Button>
          </div>
        </form>
        <AdvisoryNote />
        {a.error && <Alert tone="danger">{a.error}</Alert>}
        {a.remaining !== null && <RemainingNote remaining={a.remaining} />}

        {a.value && (
          <div className="animate-fade-in space-y-4 border-t border-line pt-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Truck className="size-4 text-trade-600" aria-hidden="true" />
              <span>{a.value.totalKg.toLocaleString("en-US")} kg needs a</span>
              <Badge tone="navy">{a.value.carrierClass} vehicle</Badge>
              <span className="text-muted">(platform weight bands — not AI)</span>
            </div>
            <div className="flex justify-end"><AiLabel>AI tips</AiLabel></div>
            <ResultSection title="Packing and handover" items={a.value.tips.tips} />
            <ResultSection title="Watch out for" items={a.value.tips.watch_outs} tone="warn" />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
