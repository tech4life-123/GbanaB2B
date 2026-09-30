import type { Metadata } from "next";
import { BadgeCheck, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { LoadCard } from "@/features/carrier/components/load-bits";
import { getMyCarrier, listLoads } from "@/features/carrier/queries";
import { requireRole } from "@/lib/auth/session";
import { CARRIER_STATUS } from "@/lib/freight";

export const metadata: Metadata = { title: "Load board" };

export default async function LoadBoardPage() {
  const viewer = await requireRole("carrier");
  const { profile, vehicles } = await getMyCarrier(viewer.id);
  const verified = profile?.verification_status === "verified";
  const loads = verified ? await listLoads(viewer.id) : [];
  const biggest = Math.max(0, ...vehicles.filter((v) => v.is_verified && v.is_active).map((v) => v.payload_kg));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Carrier"
        title="Load board"
        description={
          verified
            ? `Loads up to ${biggest.toLocaleString("en-US")} kg between ${profile!.coverage_counties.join(", ")}.`
            : "Open freight jobs that fit your vehicles and routes."
        }
      />

      {!verified ? (
        <EmptyState
          icon={<BadgeCheck className="size-5" />}
          title={profile ? CARRIER_STATUS[profile.verification_status].label : "Get verified to see loads"}
          action={<ButtonLink href="/carrier/verification">{profile ? "View verification" : "Start verification"}</ButtonLink>}
        >
          {profile ? CARRIER_STATUS[profile.verification_status].hint : "Only verified carriers can see and bid on loads. It protects buyers — and keeps unverified competitors from undercutting you."}
        </EmptyState>
      ) : (
        <>
          {!profile!.is_available && (
            <Alert tone="warning" title="You're marked as unavailable" action={<ButtonLink href="/carrier/verification" size="sm" variant="secondary">Change availability</ButtonLink>}>
              New loads are hidden until you switch availability back on.
            </Alert>
          )}
          {loads.length === 0 ? (
            <EmptyState icon={<Truck className="size-5" />} title="No open loads for you right now">
              New loads appear when sellers pack orders heading along your routes. Adding counties or a bigger verified vehicle widens what you see.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {loads.map((l) => (
                <LoadCard key={l.id} load={l} href={`/carrier/loads/${l.id}`} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
