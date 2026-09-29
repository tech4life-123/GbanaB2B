import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The GbanaB2B mark: a gunmetal shield carrying a machined "G", with the
 * amber/gold trade ribbon running through it and an emerald escrow node at
 * the centre. Pure SVG — no image request, crisp at any size, and it keeps
 * working offline.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-shield`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#4a5a63" />
          <stop offset="0.55" stopColor="#26343b" />
          <stop offset="1" stopColor="#141e23" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#aab6bd" />
          <stop offset="1" stopColor="#3b4a52" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f6f8" />
          <stop offset="1" stopColor="#9fadb5" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#FF9900" />
        </linearGradient>
        <radialGradient id={`${id}-node`} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#a7f3d0" />
          <stop offset="0.45" stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </radialGradient>
        <clipPath id={`${id}-over`}>
          <rect x="32" y="0" width="32" height="31" />
        </clipPath>
      </defs>
      <path
        d="M32 3.5 55.5 11v19.5c0 14.2-10 24.6-23.5 30-13.5-5.4-23.5-15.8-23.5-30V11Z"
        fill={`url(#${id}-shield)`}
        stroke={`url(#${id}-rim)`}
        strokeWidth="1.5"
      />
      {/* Ribbon passes behind the G on the left and over it on the right — the trade path looping through. */}
      <path
        d="M6 47c9-1.5 16-7 22.5-12.5C36 28 45 18.5 60 14"
        fill="none"
        stroke={`url(#${id}-ribbon)`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M42.6 22.2A13.5 13.5 0 1 0 45.5 32H33.5"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="6.5"
        strokeLinecap="square"
      />
      <path
        d="M6 47c9-1.5 16-7 22.5-12.5C36 28 45 18.5 60 14"
        fill="none"
        stroke={`url(#${id}-ribbon)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        clipPath={`url(#${id}-over)`}
      />
      <circle cx="32" cy="32" r="5" fill={`url(#${id}-node)`} stroke="#0f2027" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "dark",
  showTagline = false,
}: {
  className?: string;
  tone?: "dark" | "light";
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-9" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[1.2rem] font-extrabold tracking-tight",
            tone === "light" ? "text-white" : "text-trade-900",
          )}
        >
          Gbana<span className={tone === "light" ? "text-signal-500" : "text-signal-600"}>B2B</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              "label-caps mt-1 !text-[0.56rem] !tracking-[0.14em]",
              tone === "light" ? "text-trade-200" : "text-muted",
            )}
          >
            Wholesale &amp; Freight Exchange
          </span>
        )}
      </span>
    </span>
  );
}
