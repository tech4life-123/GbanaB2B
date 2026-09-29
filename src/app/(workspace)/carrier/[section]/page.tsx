import { PlannedSection } from "@/features/workspace/planned-section";

export default async function CarrierSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <PlannedSection role="carrier" segment={section} />;
}
