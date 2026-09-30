import { describe, expect, it } from "vitest";
import { buildTiers, savingsVersusFirst, tierRangeLabel, unitPriceFor, validateTiers, type PriceTier } from "@/lib/pricing/tiers";

const tiers: PriceTier[] = [
  { minQty: 10, maxQty: 49, unitPriceMinor: 2450 },
  { minQty: 50, maxQty: 99, unitPriceMinor: 2300 },
  { minQty: 100, maxQty: null, unitPriceMinor: 2150 },
];

describe("validateTiers (mirrors save_product_pricing)", () => {
  it("accepts contiguous tiers starting at MOQ with an open last band", () => {
    expect(validateTiers(10, tiers)).toEqual([]);
  });
  it("rejects a first tier that doesn't start at MOQ", () => {
    expect(validateTiers(5, tiers).some((i) => i.index === 0)).toBe(true);
  });
  it("rejects gaps", () => {
    const gap = [tiers[0]!, { ...tiers[1]!, minQty: 60 }, tiers[2]!];
    expect(validateTiers(10, gap).some((i) => i.index === 1)).toBe(true);
  });
  it("rejects a closed last tier and zero prices", () => {
    expect(validateTiers(10, [{ minQty: 10, maxQty: 20, unitPriceMinor: 0 }]).length).toBe(2);
  });
  it("limits the number of tiers", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ minQty: i + 1, maxQty: i === 10 ? null : i + 1, unitPriceMinor: 100 }));
    expect(validateTiers(1, many)[0]?.message).toMatch(/between 1 and 10/);
  });
});

describe("buildTiers", () => {
  it("derives contiguous bands from upper bounds", () => {
    expect(
      buildTiers(10, [
        { maxQty: 49, unitPriceMinor: 2450 },
        { maxQty: 99, unitPriceMinor: 2300 },
        { maxQty: 500, unitPriceMinor: 2150 },
      ]),
    ).toEqual(tiers);
  });
});

describe("tier helpers", () => {
  it("prices a quantity by its band", () => {
    expect(unitPriceFor(tiers, 9)).toBeNull();
    expect(unitPriceFor(tiers, 10)).toBe(2450);
    expect(unitPriceFor(tiers, 99)).toBe(2300);
    expect(unitPriceFor(tiers, 5000)).toBe(2150);
  });
  it("labels ranges and savings", () => {
    expect(tierRangeLabel(tiers[0]!)).toBe("10 – 49");
    expect(tierRangeLabel(tiers[2]!)).toBe("100+");
    expect(savingsVersusFirst(tiers, 2)).toBe(12);
    expect(savingsVersusFirst(tiers, 0)).toBe(0);
  });
});
