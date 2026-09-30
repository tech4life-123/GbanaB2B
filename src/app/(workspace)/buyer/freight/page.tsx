import type { Metadata } from "next";
import { Route } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { RfqList } from "@/features/freight/components/rfq-list";
import { listRfqs } from "@/features/freight/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Freight" };

export default async function BuyerFreightPage() {
  const viewer = await requireRole("buyer");
  const rfqs = await listRfqs({ scope: "buyer", viewerId: viewer.id });
  const open = rfqs.filter((r) => r.status === "open");
  const rest = rfqs.filter((r) => r.status !== "open");

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Buyer" title="Freight" description="Delivery quotes for your orders. Open a request to compare the sealed bids and book a carrier." />
      {rfqs.length === 0 ? (
        <EmptyState icon={<Route className="size-5" />} title="No freight requests yet" action={<ButtonLink href="/buyer/orders" variant="secondary">View orders</ButtonLink>}>
          When a seller marks your order ready for pickup, request freight from the order page and verified carriers will bid.
        </EmptyState>
      ) : (
        <>
          {open.length > 0 && (
            <section className="space-y-3" aria-labelledby="open-h">
              <h2 id="open-h" className="text-base font-bold text-trade-900">Taking bids</h2>
              <RfqList rfqs={open} orderHref={(id) => `/buyer/orders/${id}`} />
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-3" aria-labelledby="past-h">
              <h2 id="past-h" className="text-base font-bold text-trade-900">Booked and closed</h2>
              <RfqList rfqs={rest} orderHref={(id) => `/buyer/orders/${id}`} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
