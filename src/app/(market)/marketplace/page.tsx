import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX, Store } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { isSupabaseConfigured } from "@/config/env";
import { PAGE_SIZE } from "@/features/marketplace/constants";
import { CategoryChips, FilterPanel, SearchBar } from "@/features/marketplace/components/filters";
import { ProductGrid } from "@/features/marketplace/components/product-card";
import { listCategories, searchListings } from "@/features/marketplace/queries";
import { activeFilterCount, listingHref, parseListingQuery } from "@/features/marketplace/search-params";
import { cn } from "@/lib/utils/cn";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseListingQuery(await searchParams);
  const categories = await listCategories();
  const cat = categories.find((c) => c.slug === query.category);
  const title = query.q ? `“${query.q}” — Marketplace` : cat ? `${cat.name} — Wholesale marketplace` : "Wholesale marketplace";
  return {
    title,
    description: cat?.description ?? "Buy in bulk from importers and wholesalers across Liberia. Quantity pricing, clear minimum orders, verified sellers.",
  };
}

export default async function MarketplacePage({ searchParams }: Props) {
  const query = parseListingQuery(await searchParams);
  const [categories, result] = await Promise.all([listCategories(), searchListings(query)]);
  const category = categories.find((c) => c.slug === query.category);
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const filtered = Boolean(query.q) || activeFilterCount(query) > 0;
  const nf = new Intl.NumberFormat("en-US");

  return (
    <>
      <section className="bg-manifest text-white">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:px-6 md:pt-10">
          <p className="label-caps text-signal-400">Wholesale marketplace</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {category ? category.name : "Buy in bulk, from verified suppliers"}
          </h1>
          <p className="mt-2 max-w-2xl text-trade-200">
            {category?.description ?? "Compare quantity prices and minimum orders from importers and wholesalers across Liberia."}
          </p>
          <SearchBar query={query} className="mt-5 max-w-2xl [&_input]:border-white/10" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <CategoryChips categories={categories} query={query} />

        {!isSupabaseConfigured() && (
          <Alert tone="warning" title="Marketplace not connected" className="mt-6">
            This deployment has no database configured.
          </Alert>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <FilterPanel query={query} categories={categories} />

          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="results-heading" className="text-sm text-muted">
                <span className="tabular font-mono font-semibold text-trade-900">{nf.format(result.total)}</span>{" "}
                {result.total === 1 ? "listing" : "listings"}
                {query.q && (
                  <>
                    {" "}for <span className="font-semibold text-trade-900">“{query.q}”</span>
                  </>
                )}
                {query.currency === "LRD" && <> priced in LRD</>}
              </h2>
              {pages > 1 && (
                <p className="tabular font-mono text-xs text-muted">
                  Page {query.page} / {pages}
                </p>
              )}
            </div>

            {result.failed ? (
              <Alert tone="danger" title="We couldn't load listings">
                Check your connection and refresh the page.
              </Alert>
            ) : result.items.length === 0 ? (
              filtered ? (
                <EmptyState icon={<SearchX className="size-5" />} title="No listings match" action={<Link href="/marketplace" className={buttonClasses("outline", "md")}>Clear search & filters</Link>}>
                  Try fewer filters, a different spelling, or another category.
                  {query.currency === "LRD" && " Most sellers price in USD — try switching currency."}
                </EmptyState>
              ) : (
                <EmptyState icon={<Store className="size-5" />} title="The marketplace is opening" action={<Link href="/sign-in?intent=join&role=seller" className={buttonClasses("primary", "md")}>List your stock</Link>}>
                  Suppliers are setting up their listings now. Wholesalers and importers can list stock today.
                </EmptyState>
              )
            ) : (
              <ProductGrid items={result.items} eager={4} />
            )}

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
                <PageLink href={listingHref(query, { page: String(query.page - 1) })} disabled={query.page <= 1}>
                  <ChevronLeft className="size-4" aria-hidden="true" /> Previous
                </PageLink>
                <PageLink href={listingHref(query, { page: String(query.page + 1) })} disabled={query.page >= pages}>
                  Next <ChevronRight className="size-4" aria-hidden="true" />
                </PageLink>
              </nav>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(buttonClasses("outline", "md"), "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClasses("outline", "md")}>
      {children}
    </Link>
  );
}
