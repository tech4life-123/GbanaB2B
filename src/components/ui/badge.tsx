import type { ReactNode } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type Tone = "neutral" | "info" | "signal" | "escrow" | "gold" | "danger" | "navy";

const tones: Record<Tone, string> = {
  neutral: "bg-trade-50 text-trade-700 ring-trade-100",
  info: "bg-sky-50 text-sky-800 ring-sky-100",
  signal: "bg-signal-50 text-signal-800 ring-signal-100",
  escrow: "bg-escrow-50 text-escrow-800 ring-escrow-100",
  gold: "bg-gold-50 text-gold-700 ring-gold-100",
  danger: "bg-red-50 text-red-800 ring-red-100",
  navy: "bg-trade-900 text-white ring-trade-900",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const dotTones: Record<Tone, string> = {
  neutral: "bg-trade-300",
  info: "bg-sky-500",
  signal: "bg-signal-500",
  escrow: "bg-escrow-500",
  gold: "bg-gold-500",
  danger: "bg-red-600",
  navy: "bg-trade-900",
};

/** Status with a coloured dot. The text always carries the meaning; colour only reinforces it. */
export function StatusDot({ tone = "neutral", pulse, children }: { tone?: Tone; pulse?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-trade-800">
      <span className="relative flex size-2">
        {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", dotTones[tone])} />}
        <span className={cn("relative inline-flex size-2 rounded-full", dotTones[tone])} />
      </span>
      {children}
    </span>
  );
}

/** Reserved for admin-verified carriers and businesses — never self-declared. */
export function VerifiedBadge({ kind = "carrier" }: { kind?: "carrier" | "business" }) {
  return (
    <Badge tone="escrow">
      <BadgeCheck className="size-3.5" aria-hidden="true" />
      {kind === "carrier" ? "Verified carrier" : "Verified business"}
    </Badge>
  );
}

export function EscrowBadge({ children = "Escrow protected" }: { children?: ReactNode }) {
  return (
    <Badge tone="escrow">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {children}
    </Badge>
  );
}
