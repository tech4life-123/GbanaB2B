import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/feedback";
import type { Role } from "@/lib/auth/roles";
import { CURRENT_PHASE, PHASE_NAMES, findNavItem, navHref } from "./nav";

/**
 * Honest placeholder for a workspace section whose roadmap phase hasn't
 * shipped. It explains what will live here instead of faking a UI with
 * invented data.
 */
export function PlannedSection({ role, segment }: { role: Role; segment: string }) {
  const item = findNavItem(role, segment);
  if (!item || item.phase <= CURRENT_PHASE) notFound();
  const Icon = item.icon;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader eyebrow={`Phase ${item.phase} · ${PHASE_NAMES[item.phase]}`} title={item.label} description={item.summary} />

      <div className="relative overflow-hidden rounded-xl border border-line bg-white">
        <div className="bg-manifest absolute inset-y-0 right-0 hidden w-2/5 md:block" aria-hidden="true">
          <div className="grid h-full place-items-center">
            <Icon className="size-24 text-white/10" strokeWidth={1} />
          </div>
        </div>
        <div className="relative max-w-xl p-6 sm:p-8 md:pr-0">
          <Badge tone="signal">
            <CalendarClock className="size-3.5" aria-hidden="true" /> On the roadmap
          </Badge>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-trade-900">
            {item.label} opens in phase {item.phase}.
          </h2>
          <p className="mt-2 leading-relaxed text-muted">
            GbanaB2B is being built in phases, and each part goes live only once it&apos;s secure and fully tested.
            {` `}Nothing here is simulated — when this section appears, it will be working with real data.
          </p>
          <ol className="mt-6 flex flex-wrap gap-1.5" aria-label="Build phases">
            {Object.entries(PHASE_NAMES).map(([n, name]) => {
              const num = Number(n);
              return (
                <li
                  key={n}
                  className={
                    num <= CURRENT_PHASE
                      ? "rounded-sm bg-trade-900 px-2 py-1 text-xs font-semibold text-white"
                      : num === item.phase
                        ? "rounded-sm bg-signal-500 px-2 py-1 text-xs font-bold text-trade-900"
                        : "rounded-sm bg-trade-50 px-2 py-1 text-xs font-medium text-muted"
                  }
                  title={name}
                  aria-current={num === item.phase ? "step" : undefined}
                >
                  {num}
                  <span className="sr-only"> {name}{num <= CURRENT_PHASE ? " (done)" : ""}</span>
                </li>
              );
            })}
          </ol>
          <Link
            href={navHref(role, "")}
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-trade-700 hover:text-trade-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
