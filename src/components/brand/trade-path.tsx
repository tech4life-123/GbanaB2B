import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface FlowStep {
  key: string;
  title: string;
  detail?: string;
  icon?: ReactNode;
  /** Marks the stage where money is held — rendered in escrow emerald. */
  escrow?: boolean;
}

/**
 * The trade path: GbanaB2B's signature motif. A dashed route with numbered
 * stops, drawn like a line on a waybill. Horizontal from `md`, vertical on
 * phones so labels never get squeezed.
 */
export function TradePath({
  steps,
  tone = "light",
  orientation = "responsive",
  className,
}: {
  steps: FlowStep[];
  tone?: "light" | "dark";
  /** "responsive" = vertical on phones, horizontal from md. "vertical" = always vertical (narrow cards). */
  orientation?: "responsive" | "vertical";
  className?: string;
}) {
  const dark = tone === "dark";
  const h = orientation === "responsive";
  return (
    <ol className={cn("relative grid gap-0", h && "md:auto-cols-fr md:grid-flow-col", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className={cn("relative flex gap-4 pb-7 last:pb-0", h && "md:flex-col md:gap-3 md:pr-4 md:pb-0")}>
            {/* connector */}
            {!last && (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-9 bottom-0 left-[17px] w-0.5",
                    h && "md:hidden",
                    "bg-[linear-gradient(currentColor_50%,transparent_0)] bg-[length:2px_8px]",
                    dark ? "text-signal-500/50" : "text-signal-500/60",
                  )}
                />
                {h && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "rule-dashed absolute top-[17px] right-0 left-11 hidden md:block",
                      dark ? "text-signal-500/50" : "text-signal-500/60",
                    )}
                  />
                )}
              </>
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ring-4",
                step.escrow
                  ? "bg-escrow-500 text-trade-950 ring-escrow-500/20"
                  : dark
                    ? "bg-trade-800 text-signal-400 ring-trade-900 outline outline-1 outline-signal-500/40"
                    : "bg-white text-trade-900 ring-canvas outline outline-1 outline-line-strong",
              )}
            >
              {step.icon ?? String(i + 1).padStart(2, "0")}
            </span>
            <div className={cn("min-w-0 pt-1", h && "md:pt-0")}>
              <p className={cn("font-bold", dark ? "text-white" : "text-trade-900")}>{step.title}</p>
              {step.detail && (
                <p className={cn("mt-1 text-sm leading-relaxed", dark ? "text-trade-200" : "text-muted")}>{step.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Compact progress tracker for a single order/shipment: done → current → upcoming.
 * The current step is announced to screen readers via aria-current.
 */
export function StageTracker({
  stages,
  currentIndex,
  className,
}: {
  stages: { key: string; label: string; escrow?: boolean }[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-start", className)}>
      {stages.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[11px] right-1/2 left-[-50%] h-0.5",
                  i <= currentIndex ? "bg-trade-900" : "bg-line-strong",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-6 place-items-center rounded-full text-[0.625rem] font-bold ring-4 ring-white",
                done && (s.escrow ? "bg-escrow-600 text-white" : "bg-trade-900 text-white"),
                current && "bg-signal-500 text-trade-900",
                !done && !current && "border-2 border-line-strong bg-white text-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "mt-2 px-0.5 text-[0.6875rem] leading-tight sm:text-xs",
                current ? "font-bold text-trade-900" : done ? "font-medium text-trade-700" : "text-muted",
              )}
            >
              {s.label}
              <span className="sr-only">{done ? " (completed)" : current ? " (current)" : " (upcoming)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
