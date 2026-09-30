import { Star } from "lucide-react";
import { averageRating } from "@/lib/trust/labels";

/** Filled stars with the number beside them — never colour alone. */
export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "size-5" : "size-4";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${dim} ${n <= Math.round(value) ? "fill-signal-500 text-signal-500" : "text-trade-200"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Compact trust line for profiles and carrier bids: rating, reviews, completed orders. */
export function TrustSummary({ stats, className }: { stats: { rating_sum: number; reviews_count: number; completed_orders: number; disputes_upheld: number } | null; className?: string }) {
  const avg = stats ? averageRating(stats.rating_sum, stats.reviews_count) : null;
  const done = stats?.completed_orders ?? 0;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className ?? ""}`}>
      {avg !== null ? (
        <span className="inline-flex items-center gap-1.5">
          <Stars value={avg} /> <strong className="font-mono text-trade-900">{avg.toFixed(1)}</strong>
          <span className="text-muted">({stats!.reviews_count})</span>
        </span>
      ) : (
        <span className="text-muted">No reviews yet</span>
      )}
      <span className="text-muted">{done} completed {done === 1 ? "order" : "orders"}</span>
      {stats && stats.disputes_upheld > 0 && <span className="text-muted">{stats.disputes_upheld} upheld {stats.disputes_upheld === 1 ? "dispute" : "disputes"}</span>}
    </span>
  );
}
