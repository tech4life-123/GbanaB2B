import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { CURRENT_PHASE } from "../nav";

export interface ChecklistItem {
  label: string;
  detail?: string;
  done: boolean;
  /** Phase in which this step becomes possible. */
  phase?: number;
  href?: string;
}

export function SetupChecklist({ title, items }: { title: string; items: ChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  return (
    <Card>
      <CardHeader
        eyebrow="Account setup"
        title={title}
        action={
          <span className="tabular font-mono text-sm font-semibold text-trade-900">
            {doneCount}/{items.length}
          </span>
        }
      />
      <div className="px-5 pt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-trade-50"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Setup progress"
        >
          <div className="h-full rounded-full bg-escrow-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-line px-5 py-2">
        {items.map((item) => {
          const locked = !item.done && item.phase !== undefined && item.phase > CURRENT_PHASE;
          const body = (
            <>
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                  item.done ? "bg-escrow-500 text-white" : "text-trade-300",
                )}
              >
                {item.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <CircleDashed className="size-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", item.done ? "text-trade-700" : "text-trade-900")}>
                  {item.label}
                  <span className="sr-only">{item.done ? " — done" : locked ? " — not yet available" : " — to do"}</span>
                </span>
                {item.detail && <span className="mt-0.5 block text-[0.8125rem] text-muted">{item.detail}</span>}
              </span>
              {locked && <span className="shrink-0 rounded-sm bg-trade-50 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted">Phase {item.phase}</span>}
              {!locked && !item.done && item.href && <ArrowRight className="mt-0.5 size-4 shrink-0 text-signal-600" aria-hidden="true" />}
            </>
          );
          return (
            <li key={item.label}>
              {!locked && !item.done && item.href ? (
                <Link href={item.href} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-3 hover:bg-trade-50">
                  {body}
                </Link>
              ) : (
                <div className="flex items-start gap-3 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** A "what to prepare" card: useful guidance people can act on before a feature opens. */
export function PrepareCard({ eyebrow, title, intro, items, icon }: { eyebrow: string; title: string; intro?: string; items: { label: string; detail: string }[]; icon?: ReactNode }) {
  return (
    <Card>
      <CardHeader eyebrow={eyebrow} title={title} description={intro} action={icon && <span className="text-trade-300">{icon}</span>} />
      <ol className="space-y-3.5 px-5 py-4">
        {items.map((item, i) => (
          <li key={item.label} className="flex gap-3">
            <span className="tabular mt-px font-mono text-xs font-semibold text-signal-700">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-sm font-semibold text-trade-900">{item.label}</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}
