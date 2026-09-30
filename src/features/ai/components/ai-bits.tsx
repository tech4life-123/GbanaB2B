"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Info, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AiStatus } from "../run";

/** Says plainly whether the assistants can answer, and always that they only advise. */
export function AiStatusBanner({ status }: { status: AiStatus }) {
  if (!status.configured) {
    return (
      <Alert tone="warning" title="The assistant isn't connected yet">
        No AI provider key has been added to this site, so nothing can be answered. Everything else on GbanaB2B works as normal.
      </Alert>
    );
  }
  if (!status.enabled) {
    return (
      <Alert tone="info" title="The assistants are switched off">
        An administrator turns them on in Settings → AI.
      </Alert>
    );
  }
  return null;
}

export function AdvisoryNote() {
  return (
    <p className="flex items-start gap-2 rounded-md bg-trade-50 px-3 py-2 text-[0.8125rem] leading-relaxed text-trade-700">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Suggestions only. The assistant can make mistakes and can&rsquo;t approve payments, release escrow, decide disputes or verify anyone. Check what matters before you act.
        Phone numbers, emails and codes are removed before anything is sent.
      </span>
    </p>
  );
}

export function RemainingNote({ remaining }: { remaining: number }) {
  return <p className="text-xs text-muted">{remaining} assistant {remaining === 1 ? "request" : "requests"} left in the next 24 hours.</p>;
}

export function ResultSection({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warn" }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className={`text-sm font-bold ${tone === "warn" ? "text-signal-800" : "text-trade-900"}`}>{title}</h3>
      <ul className="mt-1.5 space-y-1.5 text-sm text-trade-800">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${tone === "warn" ? "bg-signal-500" : "bg-trade-300"}`} />
            <span className="break-words">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-trade-600">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      icon={done ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard unavailable: the text is selectable on screen */
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </Button>
  );
}
