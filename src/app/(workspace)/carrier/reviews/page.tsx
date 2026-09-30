import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { ReviewList } from "@/features/reviews/components/review-list";
import { TrustSummary } from "@/features/reviews/components/stars";
import { getTrustStats, listReviewsFor } from "@/features/reviews/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reviews" };

export default async function CarrierReviewsPage() {
  const viewer = await requireRole("carrier");
  const [stats, reviews] = await Promise.all([getTrustStats("carrier", viewer.id), listReviewsFor("carrier", viewer.id)]);
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="Reviews" description="Buyers rate deliveries once they're complete. Buyers see your rating when they compare freight bids. You can reply once to each review." />
      <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-card">
        <TrustSummary stats={stats} />
      </div>
      <ReviewList reviews={reviews} canReply />
    </div>
  );
}
