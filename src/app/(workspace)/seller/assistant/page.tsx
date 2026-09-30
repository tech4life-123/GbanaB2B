import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { getAiStatus } from "@/features/ai/run";
import { AiStatusBanner } from "@/features/ai/components/ai-bits";
import { SellerAssistant } from "@/features/ai/components/seller-assistant";
import { FreightAdvisor } from "@/features/ai/components/freight-advisor";

export const metadata: Metadata = { title: "Assistant" };

export default async function SellerAssistantPage() {
  await requireRole("seller");
  const status = await getAiStatus();
  const off = !status.configured || !status.enabled;
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Seller" title="Assistant" description="Draft a clear listing from rough notes, and plan a hand-over to a carrier. Nothing is published for you." />
      <AiStatusBanner status={status} />
      <SellerAssistant disabled={off} maxChars={status.maxInputChars} />
      <FreightAdvisor disabled={off} />
    </div>
  );
}
