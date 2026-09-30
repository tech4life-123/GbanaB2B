import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { carrierStage, type CarrierStage } from "@/lib/trust/labels";
import type { Tone } from "@/components/ui/badge";
import type { CarrierJob } from "../queries";

export const STAGE_LABEL: Record<CarrierStage, { label: string; tone: Tone }> = {
  awaiting_pickup: { label: "Ready for pickup", tone: "signal" },
  in_transit: { label: "In transit", tone: "navy" },
  arrived: { label: "Arrived · needs code", tone: "signal" },
  completed: { label: "Delivered", tone: "escrow" },
};

const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function JobList({ jobs }: { jobs: CarrierJob[] }) {
  if (jobs.length === 0) {
    return (
      <EmptyState icon={<Truck className="size-5" />} title="Nothing here yet">
        Jobs you win on the load board appear here with pickup details and delivery-code confirmation.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {jobs.map(({ assignment: a, delivery, rfq, liveDispute }) => {
        const stage = carrierStage(delivery);
        const dropoff = (a.dropoff_snapshot ?? {}) as { town?: string; county?: string };
        const pickup = (a.pickup_snapshot ?? {}) as { town?: string };
        return (
          <li key={a.id}>
            <Link href={`/carrier/deliveries/${a.order_id}`} className="group flex items-center gap-3 p-4 hover:bg-canvas">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-trade-900">
                    {pickup.town ?? "Pickup"} → {dropoff.town ?? "Drop-off"}
                  </span>
                  {a.status === "cancelled" ? <Badge tone="danger">Cancelled</Badge> : <Badge tone={STAGE_LABEL[stage].tone}>{STAGE_LABEL[stage].label}</Badge>}
                  {liveDispute && <Badge tone="danger">Dispute open</Badge>}
                </p>
                <p className="tabular mt-1 font-mono text-xs text-muted">
                  {rfq?.rfq_number} · deliver by {day.format(new Date(`${a.proposed_delivery_date}T00:00:00Z`))}
                </p>
              </div>
              <MoneyText value={{ amountMinor: a.amount_minor, currency: a.currency }} className="shrink-0 text-sm font-semibold text-trade-900" />
              <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
