import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MapPin, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { BUSINESS_TYPES, VERIFICATION } from "@/features/marketplace/constants";
import { ProductGrid } from "@/features/marketplace/components/product-card";
import { getPublicSeller, searchListings } from "@/features/marketplace/queries";
import { parseListingQuery } from "@/features/marketplace/search-params";
import { ReviewList } from "@/features/reviews/components/review-list";
import { TrustSummary } from "@/features/reviews/components/stars";
import { getTrustStats, listReviewsFor } from "@/features/reviews/queries";
import type { BusinessType } from "@/lib/db/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seller = await getPublicSeller((await params).slug);
  if (!seller) return { title: "Seller not found" };
  return {
    title: `${seller.trading_name} — wholesale supplier`,
    description: seller.description ?? `${BUSINESS_TYPES[seller.business_type as BusinessType]} in ${seller.town}, ${seller.county}.`,
  };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const seller = await getPublicSeller(slug);
  if (!seller) notFound();

  const sp = await searchParams;
  const query = parseListingQuery({ ...sp, seller: slug });
  const [usd, lrd] = await Promise.all([
    searchListings({ ...query, currency: "USD" }),
    searchListings({ ...query, currency: "LRD" }),
  ]);
  const [trust, reviews] = await Promise.all([getTrustStats("seller", seller.id), listReviewsFor("seller", seller.id, 10)]);
  const items = [...usd.items, ...lrd.items];
  const total = usd.total + lrd.total;
  const verification = VERIFICATION[seller.verification_status];
  const since = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(seller.created_at));

  return (
    <>
      <section className="bg-manifest text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
          <p className="label-caps text-signal-400">{BUSINESS_TYPES[seller.business_type as BusinessType]}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{seller.trading_name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-trade-200">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" /> {seller.town}, {seller.county}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" /> On GbanaB2B since {since}
            </span>
            <Badge tone={verification.tone} className={seller.verification_status === "verified" ? "" : "!bg-white/10 !text-trade-100 !ring-white/10"}>
              {seller.verification_status === "verified" && <BadgeCheck className="size-3.5" aria-hidden="true" />}
              {verification.label}
            </Badge>
          </div>
          <div className="mt-3 rounded-md bg-white/95 px-3 py-2 text-trade-900 sm:inline-block">
            <TrustSummary stats={trust} />
          </div>
          {seller.description && <p className="mt-4 max-w-2xl leading-relaxed text-trade-100">{seller.description}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-trade-900">Listings</h2>
          <p className="tabular font-mono text-sm text-muted">{total}</p>
        </div>
        {items.length ? (
          <ProductGrid items={items} eager={4} />
        ) : (
          <EmptyState icon={<PackageSearch className="size-5" />} title="No live listings yet">
            This seller hasn&apos;t published any stock. <Link href="/marketplace" className="font-semibold text-signal-700 underline">Browse the marketplace</Link>.
          </EmptyState>
        )}
        <h2 className="mt-10 mb-4 text-xl font-extrabold tracking-tight text-trade-900">Buyer reviews</h2>
        <ReviewList reviews={reviews} emptyText="This seller hasn't been reviewed yet." />
      </div>
    </>
  );
}
