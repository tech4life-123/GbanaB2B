import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { VehicleCard, VehicleForm } from "@/features/carrier/components/vehicles";
import { getMyCarrier } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vehicles" };

export default async function CarrierVehiclesPage() {
  const viewer = await requireRole("carrier");
  const { profile, vehicles } = await getMyCarrier(viewer.id);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="Vehicles" description="Your maximum load decides which jobs you see. Our team checks each vehicle before you can bid with it." />
      {!profile ? (
        <EmptyState icon={<Truck className="size-5" />} title="Create your driver profile first" action={<ButtonLink href="/carrier/verification">Go to verification</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <section aria-labelledby="fleet" className="space-y-3">
            <h2 id="fleet" className="text-base font-bold text-trade-900">
              Your fleet <span className="tabular font-mono text-sm font-normal text-muted">{vehicles.length}</span>
            </h2>
            {vehicles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong bg-white/60 px-4 py-8 text-center text-sm text-muted">No vehicles yet.</p>
            ) : (
              <ul className="space-y-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </ul>
            )}
          </section>
          <Card>
            <CardHeader title="Add a vehicle" description="Small: up to 300 kg · Medium: 301–3,000 kg · Large: over 3,000 kg" />
            <CardBody>
              <VehicleForm key={vehicles.length} />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
