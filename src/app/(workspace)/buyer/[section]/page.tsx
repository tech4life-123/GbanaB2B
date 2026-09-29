import { PlannedSection } from "@/features/workspace/planned-section";

export default async function BuyerSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <PlannedSection role="buyer" segment={section} />;
}
