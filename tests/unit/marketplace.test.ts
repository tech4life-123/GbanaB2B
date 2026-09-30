import { describe, expect, it } from "vitest";
import { activeFilterCount, listingHref, parseListingQuery, toWebSearch } from "@/features/marketplace/search-params";

describe("parseListingQuery", () => {
  it("parses a full query", () => {
    const q = parseListingQuery({ q: " rice ", category: "rice-grains", county: "Bong", currency: "LRD", min: "1,000", max: "5000.5", moq: "20", stock: "1", sort: "price_asc", page: "3" });
    expect(q).toMatchObject({ q: "rice", category: "rice-grains", county: "Bong", currency: "LRD", minPriceMinor: 100000, maxPriceMinor: 500050, maxMoq: 20, inStock: true, sort: "price_asc", page: 3 });
    expect(activeFilterCount(q)).toBe(6);
  });
  it("drops malformed or hostile values instead of failing", () => {
    const q = parseListingQuery({ category: "../../etc", county: "Atlantis", sort: "drop table", page: "-4", moq: "abc", min: "1e9", seller: "Robert'); --" });
    expect(q).toMatchObject({ category: null, county: null, sort: "newest", page: 1, maxMoq: null, minPriceMinor: null, seller: null });
  });
  it("builds shareable URLs and resets page when filters change", () => {
    const q = parseListingQuery({ q: "oil", page: "2" });
    expect(listingHref(q, { category: "cooking-oil" })).toBe("/marketplace?q=oil&category=cooking-oil");
    expect(listingHref(q, { page: "3" })).toBe("/marketplace?q=oil&page=3");
  });
  it("sanitises free text for websearch", () => {
    expect(toWebSearch("rice & (oil) | 25kg; drop")).toBe("rice oil 25kg drop");
    expect(toWebSearch('"palm oil" -red')).toBe('"palm oil" -red');
  });
});
