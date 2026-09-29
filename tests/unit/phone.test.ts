import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, maskPhone, normalizePhone } from "@/lib/validation/phone";

describe("normalizePhone", () => {
  it.each([
    ["0770123456", "+231770123456"],
    ["077 012 3456", "+231770123456"],
    ["770123456", "+231770123456"],
    ["+231 88 012 3456", "+231880123456"],
    ["231550123456", "+231550123456"],
    ["00231770123456", "+231770123456"],
    ["(088) 012-3456", "+231880123456"],
  ])("normalises %s", (input, e164) => {
    const r = normalizePhone(input);
    expect(r.ok && r.e164).toBe(e164);
  });

  it.each(["", "abc", "0612345678", "07701234", "+231 12 345 6789"])("rejects %s", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });

  it("accepts foreign E.164 numbers without treating them as Liberian", () => {
    const r = normalizePhone("+44 20 7946 0958");
    expect(r).toMatchObject({ ok: true, e164: "+442079460958", isLiberian: false });
  });
});

describe("phone display", () => {
  it("formats Liberian numbers", () => expect(formatPhoneForDisplay("+231770123456")).toBe("+231 77 012 3456"));
  it("masks all but the last four digits", () => {
    const m = maskPhone("+231770123456");
    expect(m.endsWith("3456")).toBe(true);
    expect(m).not.toContain("770");
  });
});
