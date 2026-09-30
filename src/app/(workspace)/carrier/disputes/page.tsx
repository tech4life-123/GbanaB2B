import type { Metadata } from "next";
import { DisputesIndex } from "@/features/disputes/components/dispute-pages";

export const metadata: Metadata = { title: "Disputes" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <DisputesIndex role="carrier" tab={(await searchParams).tab} />;
}
