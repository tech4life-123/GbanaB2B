import { z } from "zod";
import { parseMajorToMinor } from "@/lib/money/currency";
import { COUNTIES, LISTING_SORTS, type ListingSort } from "./constants";

export interface ListingQuery {
  q: string;
  category: string | null;
  seller: string | null;
  county: string | null;
  currency: "USD" | "LRD";
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  maxMoq: number | null;
  inStock: boolean;
  sort: ListingSort;
  page: number;
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/**
 * Parses untrusted URL params into a safe query. Anything malformed is
 * dropped rather than erroring — a bad shared link should still show results.
 */
export function parseListingQuery(params: Record<string, string | string[] | undefined>): ListingQuery {
  const get = (k: string) => {
    const v = first(params[k]);
    return typeof v === "string" ? v.trim() : "";
  };

  const currency = get("currency") === "LRD" ? "LRD" : "USD";
  const sortRaw = get("sort");
  const sort: ListingSort = sortRaw in LISTING_SORTS ? (sortRaw as ListingSort) : "newest";
  const county = (COUNTIES as readonly string[]).includes(get("county")) ? get("county") : null;
  const pageNum = Number.parseInt(get("page"), 10);
  const moqNum = Number.parseInt(get("moq"), 10);

  const minPriceMinor = get("min") ? parseMajorToMinor(get("min"), currency) : null;
  const maxPriceMinor = get("max") ? parseMajorToMinor(get("max"), currency) : null;

  return {
    q: get("q").slice(0, 100),
    category: slug.safeParse(get("category")).success ? get("category") : null,
    seller: slug.safeParse(get("seller")).success ? get("seller") : null,
    county,
    currency,
    minPriceMinor,
    maxPriceMinor,
    maxMoq: Number.isFinite(moqNum) && moqNum > 0 ? Math.min(moqNum, 1_000_000) : null,
    inStock: get("stock") === "1",
    sort,
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 500) : 1,
  };
}

/** Builds a marketplace URL, keeping current filters and applying overrides. */
export function listingHref(current: ListingQuery, overrides: Partial<Record<string, string | null>> = {}): string {
  const p = new URLSearchParams();
  const base: Record<string, string | null> = {
    q: current.q || null,
    category: current.category,
    seller: current.seller,
    county: current.county,
    currency: current.currency === "USD" ? null : current.currency,
    min: current.minPriceMinor !== null ? String(current.minPriceMinor / 100) : null,
    max: current.maxPriceMinor !== null ? String(current.maxPriceMinor / 100) : null,
    moq: current.maxMoq !== null ? String(current.maxMoq) : null,
    stock: current.inStock ? "1" : null,
    sort: current.sort === "newest" ? null : current.sort,
    page: current.page > 1 ? String(current.page) : null,
  };
  const merged = { ...base, page: null, ...overrides };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

/** Prepares free text for Postgres websearch_to_tsquery (strips operators we don't want). */
export function toWebSearch(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s"-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function activeFilterCount(q: ListingQuery): number {
  return [q.category, q.seller, q.county, q.minPriceMinor, q.maxPriceMinor, q.maxMoq, q.inStock ? true : null].filter(
    (v) => v !== null,
  ).length;
}
