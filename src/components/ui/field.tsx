import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const control =
  "block w-full rounded-md border border-line-strong bg-white px-3 text-[0.9375rem] text-ink placeholder:text-trade-300 " +
  "transition-colors hover:border-trade-300 focus:border-trade-700 focus:outline-none focus:ring-3 focus:ring-signal-500/25 " +
  "disabled:cursor-not-allowed disabled:bg-trade-50 disabled:text-muted " +
  "aria-invalid:border-red-600 aria-invalid:focus:ring-red-600/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}

/** Native select (best on phones) with a drawn chevron. Size the wrapper with `wrapperClassName`. */
export function Select({ className, wrapperClassName, children, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative block", wrapperClassName)}>
      <select className={cn(control, "h-11 cursor-pointer appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </span>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold text-trade-900", className)} {...props} />;
}

/**
 * Label + control + hint + error, wired for screen readers. Pass the control
 * as children and give it `id={id}` plus `aria-describedby={describedBy}`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(optional)</span>}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[0.8125rem] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  return [error ? `${id}-error` : hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}
