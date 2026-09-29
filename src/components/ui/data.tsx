import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { formatMoney, type Money } from "@/lib/money/currency";

/** Always shows the currency code — USD and LRD both use "$". */
export function MoneyText({ value, className, compact }: { value: Money; className?: string; compact?: boolean }) {
  const [code, amount] = formatMoney(value, { compact }).split(" ");
  return (
    <span className={cn("tabular font-mono whitespace-nowrap", className)}>
      <span className="mr-1 text-[0.8em] font-medium text-muted">{code}</span>
      {amount}
    </span>
  );
}

/** Scrollable table wrapper — horizontal scroll on phones instead of broken layouts. */
export function Table({ className, caption, children }: { className?: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-white", className)}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("label-caps border-b border-line bg-canvas px-4 py-2.5 font-medium text-muted", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle text-trade-900", className)} {...props} />;
}

/** Key/value rows, like the fields on a waybill. */
export function DataList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="label-caps text-muted">{item.label}</dt>
          <dd className="text-right text-sm font-medium text-trade-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
