import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Empty states explain what will appear here and what to do next. They never
 * pad the screen with invented sample data.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
  compact,
  headingLevel = 3,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  /** Use 1 when this is the whole page (e.g. not-found), so the page still has a top-level heading. */
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-white/60 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-trade-50 text-trade-600 ring-8 ring-trade-50/40">
          {icon}
        </div>
      )}
      <Heading className="text-base font-bold text-trade-900">{title}</Heading>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-trade-100/70", className)} aria-hidden="true" />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps mb-1.5 text-signal-700">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-trade-900 sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "escrow";
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <p className="label-caps text-muted">{label}</p>
      <p
        className={cn(
          "tabular mt-2 font-mono text-2xl font-semibold tracking-tight",
          tone === "escrow" ? "text-escrow-700" : "text-trade-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[0.8125rem] text-muted">{hint}</p>}
    </div>
  );
}
