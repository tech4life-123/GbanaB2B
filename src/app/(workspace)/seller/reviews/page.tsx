import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { ReviewList } from "@/features/reviews/components/review-list";
import { TrustSummary } from "@/features/reviews/components/stars";
import { getTrustStats, listReviewsFor } from "@/features/reviews/queries";
import { getMyBusiness } from "@/features/seller/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reviews" };

export default async function SellerReviewsPage() {
  await requireRole("seller");
  const business = await getMyBusiness();
  if (!business) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader eyebrow="Seller" title="Reviews" />
        <EmptyState icon={<Building2 className="size-5" />} title="Set up your business first">Reviews belong to your business profile.</EmptyState>
      </div>
    );
  }
  const [stats, reviews] = await Promise.all([getTrustStats("seller", business.id), listReviewsFor("seller", business.id)]);
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Seller" title="Reviews" description="What buyers said after their orders were delivered. You can reply once to each review; replies are public and can't be edited." />
      <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-card">
        <TrustSummary stats={stats} />
      </div>
      <ReviewList reviews={reviews} canReply />
    </div>
  );
}
