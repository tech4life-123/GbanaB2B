import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "escrow" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500 select-none";

const variants: Record<ButtonVariant, string> = {
  // Amber carries navy text: #0F2027 on #FF9900 ≈ 8.9:1.
  primary: "bg-signal-500 text-trade-900 hover:bg-signal-400 active:bg-signal-600 shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]",
  secondary: "bg-trade-900 text-white hover:bg-trade-800 active:bg-trade-950",
  outline: "border border-line-strong bg-white text-trade-900 hover:border-trade-400 hover:bg-trade-50",
  ghost: "text-trade-800 hover:bg-trade-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
  escrow: "bg-escrow-700 text-white hover:bg-escrow-800",
  inverse: "border border-white/20 bg-white/5 text-white hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  // 44px minimum touch target on md/lg.
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-12 px-5 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4 animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
