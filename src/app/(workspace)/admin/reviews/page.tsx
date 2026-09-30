import type { Metadata } from "next";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { HideReviewButton } from "@/features/reviews/components/review-forms";
import { Stars } from "@/features/reviews/components/stars";
import { listAdminReviews } from "@/features/reviews/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reviews" };

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export default async function AdminReviewsPage() {
  await requireRole("admin");
  const reviews = await listAdminReviews(150);
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin" title="Reviews" description="Hide reviews that break the rules (personal details, abuse, spam). A hidden review stops counting toward the rating and the reason is audited. Ratings are never edited." />
      {reviews.length === 0 ? (
        <EmptyState icon={<Star className="size-5" />} title="No reviews yet">Reviews appear after buyers rate completed orders.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <Badge tone="neutral">{r.subject_kind === "seller" ? "Seller" : "Carrier"}</Badge>
                  <span className="font-semibold text-trade-900">{r.subject_name ?? "Unknown"}</span>
                  {r.is_hidden && <Badge tone="danger">Hidden</Badge>}
                </p>
                <p className="text-sm text-trade-800">{r.comment ?? <span className="text-muted">No comment.</span>}</p>
                {r.reply && <p className="rounded-md bg-canvas px-3 py-2 text-sm"><span className="label-caps block text-muted">Reply</span>{r.reply}</p>}
                <p className="tabular font-mono text-xs text-muted">
                  {r.order_number} · {r.reviewer_label} · {day.format(new Date(r.created_at))}
                  {r.hidden_reason ? ` · hidden: ${r.hidden_reason}` : ""}
                </p>
              </div>
              <HideReviewButton reviewId={r.id} hidden={r.is_hidden} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
