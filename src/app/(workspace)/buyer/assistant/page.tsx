import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { getAiStatus } from "@/features/ai/run";
import { AiStatusBanner } from "@/features/ai/components/ai-bits";
import { BuyerAssistant } from "@/features/ai/components/buyer-assistant";
import { FreightAdvisor } from "@/features/ai/components/freight-advisor";

export const metadata: Metadata = { title: "Assistant" };

export default async function BuyerAssistantPage() {
  await requireRole("buyer");
  const status = await getAiStatus();
  const off = !status.configured || !status.enabled;
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Buyer" title="Assistant" description="Turn a sourcing need into real marketplace searches, and plan a delivery. It suggests; you decide." />
      <AiStatusBanner status={status} />
      <BuyerAssistant disabled={off} maxChars={status.maxInputChars} />
      <FreightAdvisor disabled={off} />
    </div>
  );
}
