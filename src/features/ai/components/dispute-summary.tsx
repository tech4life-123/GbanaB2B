"use client";

import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { summarizeDispute, type DisputeSummaryResult } from "../actions";
import { AiLabel, RemainingNote, ResultSection } from "./ai-bits";
import { useAssistant } from "./use-assistant";

/** Admin-only reading aid on a dispute. It never suggests an outcome or amount; the decision form is separate. */
export function DisputeSummary({ disputeId, disabled }: { disputeId: string; disabled: boolean }) {
  const a = useAssistant<DisputeSummaryResult>();
  const s = a.value?.summary;
  return (
    <Card>
      <CardHeader eyebrow="Reading aid" title="Summarize this dispute" description="A neutral recap of the claim and conversation. It can't see the photos and doesn't decide anything." action={s ? <AiLabel>AI summary</AiLabel> : undefined} />
      <CardBody className="space-y-4">
        <Button variant="outline" loading={a.pending} disabled={disabled} icon={<Sparkles className="size-4" aria-hidden="true" />} onClick={() => a.run(() => summarizeDispute(disputeId))}>
          {s ? "Summarize again" : "Summarize"}
        </Button>
        {disabled && <p className="text-xs text-muted">Not available: the assistants aren&rsquo;t connected or are switched off.</p>}
        {a.error && <Alert tone="danger">{a.error}</Alert>}
        {a.remaining !== null && <RemainingNote remaining={a.remaining} />}
        {s && (
          <div className="animate-fade-in space-y-4" aria-live="polite">
            <p className="text-sm text-trade-800">{s.summary}</p>
            <div>
              <h3 className="text-sm font-bold text-trade-900">What was claimed</h3>
              <p className="mt-1 text-sm text-trade-800">{s.claimed}</p>
            </div>
            <ResultSection title="About the evidence" items={s.evidence_notes} />
            <ResultSection title="Points to consider" items={s.points_to_consider} />
            <ResultSection title="Still unknown" items={s.missing_information} tone="warn" />
            <p className="text-xs text-muted">This is a summary, not a recommendation. You decide, using the evidence itself.</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
