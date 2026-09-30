import { describe, expect, it } from "vitest";
import { carrierClassFor, cmToMm, formatWeight, gramsToKgString, kgToGrams, volumeFromDimensions } from "@/lib/logistics/units";
import { buildImagePath, isValidImagePath } from "@/lib/storage/images";

describe("logistics units", () => {
  it("converts kg to integer grams", () => {
    expect(kgToGrams("25.3")).toBe(25300);
    expect(kgToGrams("0")).toBeNull();
    expect(kgToGrams("abc")).toBeNull();
    expect(gramsToKgString(25300)).toBe("25.3");
  });
  it("formats weights", () => {
    expect(formatWeight(500)).toBe("500 g");
    expect(formatWeight(25300)).toBe("25.3 kg");
  });
  it("derives volume from dimensions", () => {
    expect(cmToMm("60")).toBe(600);
    expect(volumeFromDimensions(600, 400, 150)).toBe(36000);
    expect(volumeFromDimensions(600, null, 150)).toBeNull();
  });
  it("classifies carriers by weight", () => {
    expect(carrierClassFor(300_000)).toBe("Small");
    expect(carrierClassFor(300_001)).toBe("Medium");
    expect(carrierClassFor(3_000_001)).toBe("Large");
  });
});

describe("image paths", () => {
  const b = "11111111-1111-4111-8111-111111111111";
  const p = "22222222-2222-4222-8222-222222222222";
  it("builds paths the DB accepts", () => {
    const path = buildImagePath(b, p);
    expect(isValidImagePath(path, b, p)).toBe(true);
    expect(path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+\.webp$/);
  });
  it("rejects paths for another business or with traversal", () => {
    expect(isValidImagePath(`${p}/${p}/x.webp`, b, p)).toBe(false);
    expect(isValidImagePath(`${b}/${p}/../x.webp`, b, p)).toBe(false);
    expect(isValidImagePath(`${b}/${p}/a/b.webp`, b, p)).toBe(false);
  });
});
