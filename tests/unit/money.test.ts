import { describe, expect, it } from "vitest";
import { formatBps, formatMoney, money, parseMajorToMinor } from "@/lib/money/currency";

describe("money", () => {
  it("rejects non-integer minor amounts", () => {
    expect(() => money(10.5, "USD")).toThrow(RangeError);
  });
  it("always prints the currency code (USD and LRD both use $)", () => {
    expect(formatMoney(money(125050, "USD"))).toBe("USD 1,250.50");
    expect(formatMoney(money(125050, "LRD"))).toBe("LRD 1,250.50");
  });
  it("parses major units without float drift", () => {
    expect(parseMajorToMinor("0.29", "USD")).toBe(29);
    expect(parseMajorToMinor("1,250.5", "USD")).toBe(125050);
    expect(parseMajorToMinor("19.999", "USD")).toBeNull();
    expect(parseMajorToMinor("-5", "USD")).toBeNull();
  });
  it("formats basis points", () => {
    expect(formatBps(250)).toBe("2.5%");
    expect(formatBps(300)).toBe("3%");
  });
});
