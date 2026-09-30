import { Star } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import type { PublicReview } from "../queries";
import { ReplyForm } from "./review-forms";
import { Stars } from "./stars";

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export function ReviewList({ reviews, canReply, emptyText }: { reviews: PublicReview[]; canReply?: boolean; emptyText?: string }) {
  if (reviews.length === 0) {
    return (
      <EmptyState compact icon={<Star className="size-5" />} title="No reviews yet">
        {emptyText ?? "Reviews appear here after buyers rate completed orders."}
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Stars value={r.rating} />
            <span className="text-xs text-muted">
              {r.reviewer_label} · {day.format(new Date(r.created_at))}
            </span>
          </div>
          {r.comment ? <p className="text-sm text-trade-800">{r.comment}</p> : <p className="text-sm text-muted">No comment.</p>}
          {r.reply ? (
            <p className="rounded-md bg-canvas px-3 py-2 text-sm">
              <span className="label-caps block text-muted">Reply</span>
              {r.reply}
            </p>
          ) : (
            canReply && <ReplyForm reviewId={r.id} />
          )}
        </li>
      ))}
    </ul>
  );
}
