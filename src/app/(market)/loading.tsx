import { Skeleton } from "@/components/ui/feedback";

export default function MarketLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-9 w-2/3 max-w-md" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
