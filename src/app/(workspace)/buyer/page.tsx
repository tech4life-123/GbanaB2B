import type { Metadata } from "next";
import { ClipboardList, PackageSearch } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { StageTracker, TradePath } from "@/components/brand/trade-path";
import { SetupChecklist, firstName } from "@/features/workspace/components/dashboard";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Buyer workspace" };

const ORDER_STAGES = [
  { key: "ordered", label: "Ordered" },
  { key: "freight", label: "Freight" },
  { key: "escrow", label: "Paid", escrow: true },
  { key: "transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
];

export default async function BuyerOverviewPage() {
  const viewer = await getViewer();
  const name = viewer?.profile?.display_name || viewer?.profile?.full_name;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Buyer workspace"
        title={`Welcome, ${firstName(name)}`}
        description="Restock in bulk, compare carriers and pay into escrow — all from one place."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Active orders" title="Your orders" description="Every order shows exactly where it is on the trade path." />
            <CardBody className="space-y-6">
              <div className="rounded-lg border border-dashed border-line-strong bg-canvas px-4 pt-5 pb-4" aria-hidden="true">
                <StageTracker stages={ORDER_STAGES} currentIndex={-1} />
              </div>
              <EmptyState compact icon={<ClipboardList className="size-5" />} title="No orders yet" className="border-0 bg-transparent !py-2">
                When you place your first wholesale order it will appear here with its live status, invoice and delivery
                details. Ordering opens in phase 3.
              </EmptyState>
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="How buying works" title="From order to your shop floor" />
            <CardBody>
              <TradePath
                orientation="vertical"
                steps={[
                  { key: "1", title: "Order at locked prices", detail: "Tier price for your quantity, captured on a proforma invoice." },
                  { key: "2", title: "Pick a carrier", detail: "Verified carriers bid privately. Choose on price and ETA." },
                  { key: "3", title: "Pay into escrow", detail: "Your Mobile Money payment is held, not paid out.", escrow: true },
                  { key: "4", title: "Confirm delivery", detail: "Give the driver your 4-digit code only once the goods check out." },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <SetupChecklist
            title="Get ready to buy"
            items={[
              { label: "Verify your phone number", detail: "Your account and sign-in identity.", done: Boolean(viewer?.phone) },
              { label: "Add your name", detail: "Used on invoices and orders.", done: Boolean(viewer?.profile?.full_name) },
              { label: "Add your business", detail: "Shop name and location for deliveries.", done: false, phase: 2 },
              { label: "Save a delivery address", detail: "Where carriers drop your stock.", done: false, phase: 3 },
              { label: "Link a Mobile Money wallet", detail: "MTN MoMo or Orange Money.", done: false, phase: 5 },
            ]}
          />
          <div className="bg-manifest rounded-lg text-white shadow-card">
            <CardBody className="flex gap-4">
              <PackageSearch className="size-6 shrink-0 text-signal-400" aria-hidden="true" />
              <div>
                <p className="font-bold">Marketplace opens in phase 2</p>
                <p className="mt-1 text-sm leading-relaxed text-trade-200">
                  Search wholesale stock by category, minimum order quantity and price tier, from sellers across Liberia.
                </p>
              </div>
            </CardBody>
          </div>
        </div>
      </div>
    </div>
  );
}
