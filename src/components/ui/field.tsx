import type { ComponentProps, ReactNode } from "react";
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

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2352616b%22><path d=%22M5.5 7.5 10 12l4.5-4.5%22 stroke=%22%2352616b%22 stroke-width=%221.6%22 fill=%22none%22/></svg>')] bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
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
