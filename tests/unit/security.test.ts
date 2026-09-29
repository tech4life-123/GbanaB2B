import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/security/redirect";
import { redact } from "@/lib/logging/logger";
import { isProtectedPath } from "@/lib/db/supabase/proxy";

describe("safeNextPath (open-redirect guard)", () => {
  it.each(["/buyer", "/admin/settings?x=1", "/seller#top"])("keeps same-origin path %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "buyer", "/\u0000x", ""])(
    "rejects %s",
    (p) => expect(safeNextPath(p, "/fallback")).toBe("/fallback"),
  );
});

describe("logger redaction", () => {
  it("redacts secrets, OTPs and phone numbers at any depth", () => {
    const out = redact({ phone: "+231770000001", nested: { otpCode: "1234", apiKey: "k", ok: 1 } }) as Record<string, unknown>;
    expect(out.phone).toBe("[redacted]");
    expect(out.nested).toEqual({ otpCode: "[redacted]", apiKey: "[redacted]", ok: 1 });
  });
});

describe("protected paths", () => {
  it("covers every workspace", () => {
    for (const p of ["/buyer", "/seller/listings", "/carrier", "/admin/audit", "/onboarding"]) expect(isProtectedPath(p)).toBe(true);
  });
  it("leaves public pages open and avoids prefix collisions", () => {
    for (const p of ["/", "/sign-in", "/design-system", "/buyers-guide", "/administrator"]) expect(isProtectedPath(p)).toBe(false);
  });
});
