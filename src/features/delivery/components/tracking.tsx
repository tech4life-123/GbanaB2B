import { CheckCircle2, MapPin, PackageCheck, Truck, TriangleAlert, Flag } from "lucide-react";
import { DELIVERY_EVENT, PARTY_LABEL } from "@/lib/trust/labels";
import type { DeliveryEventRow } from "../queries";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

const ICON: Record<string, React.ReactNode> = {
  picked_up: <PackageCheck className="size-4" aria-hidden="true" />,
  checkpoint: <MapPin className="size-4" aria-hidden="true" />,
  arrived: <Flag className="size-4" aria-hidden="true" />,
  delivery_failed: <TriangleAlert className="size-4" aria-hidden="true" />,
  delivered: <CheckCircle2 className="size-4" aria-hidden="true" />,
};

/** Newest first. Coordinates, when the carrier shared them, open in OpenStreetMap — we never stream GPS. */
export function TrackingTimeline({ events }: { events: DeliveryEventRow[] }) {
  if (events.length === 0) return null;
  const rows = [...events].reverse();
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-6">
      {rows.map((e) => {
        const bad = e.kind === "delivery_failed";
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-0.5 -left-[2.125rem] grid size-6 place-items-center rounded-full ring-4 ring-white ${bad ? "bg-red-700 text-white" : e.kind === "delivered" ? "bg-escrow-700 text-white" : "bg-trade-900 text-white"}`}
            >
              {ICON[e.kind] ?? <Truck className="size-4" aria-hidden="true" />}
            </span>
            <p className="text-sm font-semibold text-trade-900">{DELIVERY_EVENT[e.kind]?.label ?? e.kind}</p>
            <p className="text-xs text-muted">
              {PARTY_LABEL[e.actor_role] ?? e.actor_role} · {when.format(new Date(e.created_at))}
            </p>
            {e.note && <p className="mt-1 text-sm text-trade-800">“{e.note}”</p>}
            {e.lat !== null && e.lng !== null && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=16/${e.lat}/${e.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-trade-700 underline"
              >
                <MapPin className="size-3.5" aria-hidden="true" /> Approximate location
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
