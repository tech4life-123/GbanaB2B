import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, PackageOpen } from "lucide-react";
import { formatMoney } from "@/lib/money/currency";
import { productImageUrl } from "@/lib/storage/images";
import type { Listing } from "../queries";

const nf = new Intl.NumberFormat("en-US");

/**
 * Listing card. Price shows the best (lowest) tier as "from", because that's
 * what a bulk buyer compares; MOQ sits right beside it so nobody is misled
 * about the minimum commitment.
 */
export function ProductCard({ item, priority = false }: { item: Listing; priority?: boolean }) {
  const img = productImageUrl(item.cover_image_path);
  const currency = item.currency ?? "USD";
  const fromPrice = item.min_price_minor;
  const hasRange = item.tier_count !== null && item.tier_count > 1;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-card transition-shadow hover:shadow-raised focus-within:ring-2 focus-within:ring-signal-500">
      <div className="relative aspect-[4/3] bg-trade-50">
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            quality={60}
            priority={priority}
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-full place-items-center text-trade-300" aria-hidden="true">
            <PackageOpen className="size-10" strokeWidth={1.25} />
          </div>
        )}
        {item.quantity_available === 0 && (
          <span className="absolute top-2 left-2 rounded-sm bg-trade-900/90 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="label-caps !text-[0.625rem] text-muted">{item.category_name}</p>
        <h3 className="mt-1 line-clamp-2 text-[0.9375rem] leading-snug font-bold text-trade-900">
          <Link href={`/products/${item.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted">per {item.unit_label}</p>

        <div className="mt-auto pt-3">
          {fromPrice !== null ? (
            <p className="tabular font-mono text-trade-900">
              {hasRange && <span className="mr-1 font-sans text-xs text-muted">from</span>}
              <span className="text-xs font-medium text-muted">{currency} </span>
              <span className="text-lg font-semibold">{formatMoney({ amountMinor: fromPrice, currency }, { withCode: false })}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">Price on request</p>
          )}
          <p className="mt-0.5 text-xs font-medium text-trade-700">
            Min. order <span className="tabular font-mono">{nf.format(item.moq ?? 1)}</span>
          </p>
        </div>

        <div className="mt-3 space-y-0.5 border-t border-line pt-2.5 text-xs">
          <p className="flex items-center gap-1 font-medium text-trade-800">
            {item.business_verification === "verified" && (
              <BadgeCheck className="size-3.5 shrink-0 text-escrow-600" aria-label="Verified business" />
            )}
            <span className="truncate">{item.business_name}</span>
          </p>
          <p className="flex items-center gap-1 text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.business_county}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items, eager = 0 }: { items: Listing[]; eager?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item, i) => (
        <li key={item.id}>
          <ProductCard item={item} priority={i < eager} />
        </li>
      ))}
    </ul>
  );
}
