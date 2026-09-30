import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Clock, Layers, Package, Phone, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { formatWeight } from "@/lib/logistics/units";
import { BID_STATUS, timeLeft, VEHICLE_CLASS } from "@/lib/freight";
import { cn } from "@/lib/utils/cn";
import type { BoardLoad } from "../queries";

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export function formatDay(date: string) {
  return dayFmt.format(new Date(`${date}T00:00:00Z`));
}

/** Pickup → destination, the way drivers read a waybill. */
export function Route({ from, to, className }: { from: { town: string; county: string }; to: { town: string; county: string }; className?: string }) {
  return (
    <div className={cn("flex items-stretch gap-3", className)}>
      <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
        <span className="size-2.5 rounded-full border-2 border-trade-900 bg-white" />
        <span className="my-1 w-px flex-1 bg-trade-300" />
        <span className="size-2.5 rounded-full bg-signal-500" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="leading-tight">
          <span className="sr-only">From </span>
          <span className="font-bold text-trade-900">{from.town}</span>
          <span className="block text-xs text-muted">{from.county}</span>
        </p>
        <p className="leading-tight">
          <span className="sr-only">To </span>
          <span className="font-bold text-trade-900">{to.town}</span>
          <span className="block text-xs text-muted">{to.county}</span>
        </p>
      </div>
    </div>
  );
}

export function LoadCard({ load, href }: { load: BoardLoad; href: string }) {
  const left = timeLeft(load.closes_at);
  const bid = load.myBid;
  return (
    <li>
      <Link href={href} className="group block rounded-lg border border-line bg-white p-4 shadow-card transition-colors hover:border-trade-300 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Route from={{ town: load.pickup_town, county: load.pickup_county }} to={{ town: load.destination_town, county: load.destination_county }} />
          <div className="shrink-0 text-right">
            <p className="tabular font-mono text-lg font-semibold text-trade-900">{formatWeight(load.cargo_weight_g)}</p>
            <p className="text-xs text-muted">{VEHICLE_CLASS[load.required_class].label} load</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-trade-800">{load.cargo_summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" /> Pickup {formatDay(load.pickup_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="size-3.5" aria-hidden="true" /> {load.package_count.toLocaleString("en-US")} pieces
          </span>
          {load.is_fragile && (
            <span className="inline-flex items-center gap-1 font-medium text-signal-800">
              <AlertTriangle className="size-3.5" aria-hidden="true" /> Fragile
            </span>
          )}
          {!load.is_stackable && (
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" aria-hidden="true" /> Don&apos;t stack
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", left.urgent ? "text-signal-800" : "text-trade-700")}>
            <Clock className="size-3.5" aria-hidden="true" /> {left.label}
          </span>
          {bid ? (
            <span className="flex items-center gap-2 text-xs">
              <Badge tone={BID_STATUS[bid.status].tone}>{BID_STATUS[bid.status].label}</Badge>
              {bid.status === "submitted" && <MoneyText value={{ amountMinor: bid.amount_minor, currency: load.currency }} className="text-sm font-semibold text-trade-900" />}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-signal-700 group-hover:text-signal-800">
              Place bid <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export function CargoFacts({ load }: { load: Pick<BoardLoad, "cargo_weight_g" | "cargo_volume_cm3" | "package_count" | "required_class" | "is_fragile" | "is_stackable"> }) {
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-white sm:grid-cols-4 sm:divide-y-0">
      <Fact icon={<Scale className="size-4" />} label="Weight" value={formatWeight(load.cargo_weight_g)} />
      <Fact icon={<Package className="size-4" />} label="Pieces" value={load.package_count.toLocaleString("en-US")} />
      <Fact icon={<Layers className="size-4" />} label="Volume" value={load.cargo_volume_cm3 ? `${nf.format(load.cargo_volume_cm3 / 1_000_000)} m³` : "—"} />
      <Fact icon={<AlertTriangle className="size-4" />} label="Handling" value={[load.is_fragile && "Fragile", !load.is_stackable && "No stacking"].filter(Boolean).join(" · ") || "Standard"} />
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <p className="label-caps flex items-center gap-1.5 !text-[0.625rem] text-muted">
        <span className="text-trade-400" aria-hidden="true">
          {icon}
        </span>
        {label}
      </p>
      <p className="tabular mt-1 font-mono text-sm font-semibold text-trade-900">{value}</p>
    </div>
  );
}

/** A named place or person with address lines and a tap-to-call button. */
export function ContactBlock({ icon, title, name, phone, lines }: { icon: React.ReactNode; title: string; name?: string; phone?: string | null; lines: (string | null | undefined)[] }) {
  return (
    <div>
      <p className="label-caps flex items-center gap-1.5 text-muted">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      <p className="mt-1 font-bold text-trade-900">{name}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-sm text-trade-800">
          {l}
        </p>
      ))}
      {phone && (
        <a href={`tel:${phone}`} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 font-mono text-sm font-semibold text-trade-900 hover:bg-trade-50">
          <Phone className="size-3.5" aria-hidden="true" /> {phone}
        </a>
      )}
    </div>
  );
}
