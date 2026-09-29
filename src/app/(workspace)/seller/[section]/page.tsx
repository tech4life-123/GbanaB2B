import { PlannedSection } from "@/features/workspace/planned-section";

export default async function SellerSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <PlannedSection role="seller" segment={section} />;
}
