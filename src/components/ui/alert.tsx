import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const styles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-trade-200 bg-trade-50 text-trade-900", icon: <Info className="size-5 text-trade-600" aria-hidden="true" /> },
  success: { box: "border-escrow-200 bg-escrow-50 text-escrow-800", icon: <CheckCircle2 className="size-5 text-escrow-600" aria-hidden="true" /> },
  warning: { box: "border-signal-200 bg-signal-50 text-signal-800", icon: <AlertTriangle className="size-5 text-signal-600" aria-hidden="true" /> },
  danger: { box: "border-red-200 bg-red-50 text-red-900", icon: <XCircle className="size-5 text-red-600" aria-hidden="true" /> },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = styles[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", s.box, className)}
    >
      <span className="mt-px shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5" : undefined, "leading-relaxed opacity-90")}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
