import { PlannedSection } from "@/features/workspace/planned-section";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <PlannedSection role="admin" segment={section} />;
}
