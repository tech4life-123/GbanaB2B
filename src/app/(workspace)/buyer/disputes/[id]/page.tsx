import type { Metadata } from "next";
import { DisputePage } from "@/features/disputes/components/dispute-pages";

export const metadata: Metadata = { title: "Dispute" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DisputePage role="buyer" id={(await params).id} />;
}
