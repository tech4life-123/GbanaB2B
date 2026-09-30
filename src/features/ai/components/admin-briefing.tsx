"use client";

import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { adminBriefing, type AdminOverviewResult } from "../actions";
import { AdvisoryNote, AiLabel, RemainingNote, ResultSection } from "./ai-bits";
import { useAssistant } from "./use-assistant";

/** Narrates the numbers shown above it. The numbers are computed by the database; the AI only reads them out. */
export function AdminBriefing({ days, disabled }: { days: number; disabled: boolean }) {
  const a = useAssistant<AdminOverviewResult>();
  const b = a.value?.briefing;
  return (
    <Card>
      <CardHeader eyebrow="Briefing" title={`Plain-language summary · last ${days} days`} description="Reads out the figures above and points to what a person should look at first." action={b ? <AiLabel>AI summary</AiLabel> : undefined} />
      <CardBody className="space-y-4">
        <div>
          <Button loading={a.pending} disabled={disabled} icon={<Sparkles className="size-4" aria-hidden="true" />} onClick={() => a.run(() => adminBriefing({ days }))}>
            {b ? "Write it again" : "Write the briefing"}
          </Button>
        </div>
        <AdvisoryNote />
        {a.error && <Alert tone="danger">{a.error}</Alert>}
        {a.remaining !== null && <RemainingNote remaining={a.remaining} />}
        {b && (
          <div className="animate-fade-in space-y-4" aria-live="polite">
            <p className="text-base font-semibold text-trade-900">{b.headline}</p>
            <ResultSection title="Highlights" items={b.highlights} />
            <ResultSection title="Look at first" items={b.attention} tone="warn" />
            <p className="text-xs text-muted">Flags such as repeat cancellations are counts, not findings. Review the records before acting on anyone.</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
