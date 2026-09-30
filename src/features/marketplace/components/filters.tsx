import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import type { CategoryRow } from "@/lib/db/types";
import { COUNTIES, LISTING_SORTS } from "../constants";
import { activeFilterCount, listingHref, type ListingQuery } from "../search-params";

/**
 * Plain GET form — works without JavaScript and every result page is a
 * shareable URL (useful on WhatsApp).
 */
export function SearchBar({ query, className }: { query: ListingQuery; className?: string }) {
  return (
    <form action="/marketplace" role="search" className={cn("flex gap-2", className)}>
      {query.category && <input type="hidden" name="category" value={query.category} />}
      <label htmlFor="q" className="sr-only">
        Search products
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-trade-400" aria-hidden="true" />
        <Input id="q" name="q" type="search" defaultValue={query.q} placeholder="Rice, cement, cooking oil…" className="pl-9" enterKeyHint="search" />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}

export function CategoryChips({ categories, query }: { categories: CategoryRow[]; query: ListingQuery }) {
  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1">
        <li>
          <Chip href={listingHref(query, { category: null })} active={!query.category}>
            All
          </Chip>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Chip href={listingHref(query, { category: c.slug })} active={query.category === c.slug}>
              {c.name}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
        active ? "border-trade-900 bg-trade-900 text-white" : "border-line-strong bg-white text-trade-800 hover:border-trade-400",
      )}
    >
      {children}
    </Link>
  );
}

export function FilterPanel({ query, categories }: { query: ListingQuery; categories: CategoryRow[] }) {
  const count = activeFilterCount(query);
  const fields = (
    <form action="/marketplace" className="space-y-4">
      {query.q && <input type="hidden" name="q" value={query.q} />}
      {query.seller && <input type="hidden" name="seller" value={query.seller} />}
      <FilterField label="Category" htmlFor="f-category">
        <Select id="f-category" name="category" defaultValue={query.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Seller location" htmlFor="f-county">
        <Select id="f-county" name="county" defaultValue={query.county ?? ""}>
          <option value="">Anywhere in Liberia</option>
          {COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FilterField>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-trade-900">Unit price</legend>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <Select name="currency" defaultValue={query.currency} aria-label="Currency" wrapperClassName="w-[5.5rem]">
            <option value="USD">USD</option>
            <option value="LRD">LRD</option>
          </Select>
          <Input name="min" inputMode="decimal" placeholder="Min" aria-label="Minimum unit price" defaultValue={query.minPriceMinor !== null ? query.minPriceMinor / 100 : ""} className="tabular font-mono" />
          <Input name="max" inputMode="decimal" placeholder="Max" aria-label="Maximum unit price" defaultValue={query.maxPriceMinor !== null ? query.maxPriceMinor / 100 : ""} className="tabular font-mono" />
        </div>
      </fieldset>
      <FilterField label="Minimum order no more than" htmlFor="f-moq">
        <Input id="f-moq" name="moq" inputMode="numeric" placeholder="e.g. 20" defaultValue={query.maxMoq ?? ""} className="tabular font-mono" />
      </FilterField>
      <label className="flex items-center gap-2.5 text-sm font-medium text-trade-900">
        <input type="checkbox" name="stock" value="1" defaultChecked={query.inStock} className="size-4 accent-trade-900" />
        In stock only
      </label>
      <FilterField label="Sort by" htmlFor="f-sort">
        <Select id="f-sort" name="sort" defaultValue={query.sort}>
          {Object.entries(LISTING_SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </FilterField>
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="secondary" className="flex-1">
          Apply filters
        </Button>
        {count > 0 && (
          <Link href={query.q ? `/marketplace?q=${encodeURIComponent(query.q)}` : "/marketplace"} className={buttonClasses("outline", "md")}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-20 rounded-lg border border-line bg-white p-4 shadow-card">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold text-trade-900">
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters
          </p>
          {fields}
        </div>
      </aside>
      {/* Phone: collapsible, no JS */}
      <details className="group rounded-lg border border-line bg-white lg:hidden" open={false}>
        <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-trade-900 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters & sort
          {count > 0 && <span className="rounded-full bg-signal-500 px-1.5 text-xs font-bold text-trade-900">{count}</span>}
          <X className="ml-auto hidden size-4 group-open:block" aria-hidden="true" />
        </summary>
        <div className="border-t border-line p-4">{fields}</div>
      </details>
    </>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-trade-900">
        {label}
      </label>
      {children}
    </div>
  );
}
