import type { Metadata } from "next";
import { Package, Tags } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { PrepareCard, SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Seller workspace" };

export default async function SellerOverviewPage() {
  const viewer = await getViewer();
  const name = viewer?.profile?.display_name || viewer?.profile?.full_name;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Seller workspace"
        title={`Welcome, ${firstName(name)}`}
        description="List stock by the carton, bag or pallet and sell to retailers across Liberia."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Catalogue" title="Your listings" />
            <CardBody>
              <EmptyState compact icon={<Package className="size-5" />} title="No listings yet">
                Listings open in phase 2. Each one will carry its MOQ, quantity-tier prices, weight and packaging so buyers
                — and carriers — know exactly what they&apos;re getting.
              </EmptyState>
            </CardBody>
          </Card>

          <PrepareCard
            eyebrow="Prepare now"
            title="What a strong listing needs"
            intro="Gather these while listings are being built — you'll be ready to publish on day one."
            icon={<Tags className="size-5" />}
            items={[
              { label: "Clear product photos", detail: "Show the packaging buyers will receive. Good light, plain background." },
              { label: "Minimum order quantity", detail: "The smallest amount you'll sell — e.g. 10 bags or 1 carton." },
              { label: "Quantity price tiers", detail: "For example 1–49 units, 50–99 units, 100+ units, each with its own price." },
              { label: "Weight and size per unit", detail: "Freight is priced from these, so buyers get accurate carrier bids." },
              { label: "Packaging and handling", detail: "Carton, sack, jerrycan, pallet; fragile, keep dry, do not stack." },
            ]}
          />
        </div>

        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to sell"
            items={[
              { label: "Verify your phone number", done: Boolean(viewer?.phone) },
              { label: "Add your name", done: Boolean(viewer?.profile?.full_name) },
              { label: "Create your business profile", detail: "Name, location, registration.", done: false, phase: 2 },
              { label: "Publish your first listing", done: false, phase: 2 },
              { label: "Set your payout wallet", detail: "Where released escrow funds go.", done: false, phase: 5 },
            ]}
          />
          <Card>
            <CardBody>
              <p className="label-caps text-muted">How you get paid</p>
              <p className="mt-2 text-sm leading-relaxed text-trade-800">
                Buyers pay into escrow before goods move. When the buyer confirms delivery, your share — the product
                subtotal less the platform fee — is released to you.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
