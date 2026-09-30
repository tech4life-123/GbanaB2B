import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageOpen, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { PRODUCT_STATUS } from "@/features/marketplace/constants";
import { countMyListings, getMyBusiness, listMyListings } from "@/features/seller/queries";
import { formatMoney } from "@/lib/money/currency";
import { productImageUrl } from "@/lib/storage/images";
import { cn } from "@/lib/utils/cn";
import type { ProductStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Listings" };

const FILTERS: { key: ProductStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "paused", label: "Paused" },
  { key: "archived", label: "Archived" },
];

export default async function SellerListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; deleted?: string }> }) {
  const business = await getMyBusiness();
  if (!business) redirect("/seller/business");
  const sp = await searchParams;
  const status = (FILTERS.find((f) => f.key === sp.status)?.key ?? "all") as ProductStatus | "all";
  const [listings, counts] = await Promise.all([listMyListings(business.id, status), countMyListings(business.id)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const nf = new Intl.NumberFormat("en-US");

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow={business.trading_name}
        title="Listings"
        description="Everything you sell. Only live listings are visible to buyers."
        actions={
          business.status === "active" ? (
            <ButtonLink href="/seller/listings/new" icon={<Plus className="size-4" aria-hidden="true" />}>
              New listing
            </ButtonLink>
          ) : undefined
        }
      />

      {sp.deleted && <Alert tone="success">Draft deleted.</Alert>}

      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg border border-line bg-white p-1">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? total : counts[f.key];
            const active = status === f.key;
            return (
              <li key={f.key}>
                <Link
                  href={f.key === "all" ? "/seller/listings" : `/seller/listings?status=${f.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold",
                    active ? "bg-trade-900 text-white" : "text-trade-700 hover:bg-trade-50",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular font-mono text-xs", active ? "text-trade-200" : "text-muted")}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {listings.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-5" />}
          title={total === 0 ? "No listings yet" : "Nothing here"}
          action={total === 0 && business.status === "active" ? <ButtonLink href="/seller/listings/new">Create your first listing</ButtonLink> : undefined}
        >
          {total === 0 ? "Add a product with its minimum order, quantity prices and weight, then publish it to the marketplace." : "No listings with this status."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {listings.map((l) => {
            const cover = [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0];
            const src = productImageUrl(cover?.storage_path);
            const from = l.tiers.length ? Math.min(...l.tiers.map((t) => t.unit_price_minor)) : null;
            const meta = PRODUCT_STATUS[l.status];
            return (
              <li key={l.id}>
                <Link href={`/seller/listings/${l.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas sm:gap-4 sm:p-4">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-trade-50 sm:size-16">
                    {src ? <Image src={src} alt="" fill sizes="64px" quality={60} className="object-cover" /> : <PackageOpen className="m-auto mt-4 size-6 text-trade-300" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-trade-900">{l.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {l.category?.name} · per {l.unit_label}
                    </span>
                    <span className="tabular mt-1 flex flex-wrap gap-x-3 font-mono text-xs text-trade-700">
                      <span>{from !== null ? `from ${formatMoney({ amountMinor: from, currency: l.currency })}` : "No price yet"}</span>
                      <span>MOQ {nf.format(l.moq)}</span>
                      <span>Stock {nf.format(l.quantity_available)}</span>
                    </span>
                  </span>
                  <Badge tone={meta.tone} className="shrink-0">
                    {meta.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
