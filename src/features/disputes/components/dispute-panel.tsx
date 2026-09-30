import Link from "next/link";
import { ChevronRight, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { canOpenDispute, DISPUTE_KIND, DISPUTE_STATUS, isLiveDispute } from "@/lib/trust/labels";
import type { DisputeRow } from "../queries";
import { OpenDisputeButton } from "./open-dispute";

/**
 * Trust section of an order page: disputes on this order, or the way to raise one.
 * Only parties to the order see it, and only while money is in escrow.
 */
export function DisputePanel({
  order,
  role,
  disputes,
}: {
  order: { id: string; status: string; currency: CurrencyCode; total_minor: number };
  role: "buyer" | "seller" | "admin";
  disputes: DisputeRow[];
}) {
  const live = disputes.some((d) => isLiveDispute(d.status));
  const canOpen = role !== "admin" && canOpenDispute(order.status) && !live;
  if (disputes.length === 0 && !canOpen) return null;
  return (
    <Card>
      <CardHeader eyebrow="Trust" title={disputes.length ? "Disputes" : "Something wrong?"} description={disputes.length ? undefined : "Missing, damaged or wrong goods? Report it while the payment is still held in escrow."} action={<Gavel className="size-5 text-trade-400" aria-hidden="true" />} />
      <CardBody className="space-y-4">
        {disputes.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {disputes.map((d) => (
              <li key={d.id}>
                <Link href={`/${role}/disputes/${d.id}`} className="group flex items-center gap-3 px-4 py-3 text-sm hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-trade-900">{DISPUTE_KIND[d.kind].label}</span>
                      <Badge tone={DISPUTE_STATUS[d.status].tone}>{DISPUTE_STATUS[d.status].label}</Badge>
                    </span>
                    <span className="tabular block font-mono text-xs text-muted">{d.dispute_number}</span>
                  </span>
                  <ChevronRight className="size-4 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canOpen && (
          <OpenDisputeButton orderId={order.id} role={role} currency={order.currency} totalLabel={formatMoney({ amountMinor: order.total_minor, currency: order.currency })} />
        )}
      </CardBody>
    </Card>
  );
}
