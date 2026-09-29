import { describe, expect, it } from "vitest";
import { isSelfAssignableRole, resolveHomeRole, ROLE_META, ROLES } from "@/lib/auth/roles";
import { onboardingSchema, sendOtpSchema, verifyOtpSchema } from "@/features/auth/schemas";
import { CURRENT_PHASE, NAV } from "@/features/workspace/nav";

describe("roles", () => {
  it("never allows admin to be self-assigned", () => {
    expect(isSelfAssignableRole("admin")).toBe(false);
    expect(onboardingSchema.safeParse({ fullName: "Ada Ade", role: "admin" }).success).toBe(false);
  });
  it("prefers the stored default when held, otherwise a sensible order", () => {
    expect(resolveHomeRole(["buyer", "seller"], "buyer")).toBe("buyer");
    expect(resolveHomeRole(["buyer", "seller"], "admin")).toBe("seller");
    expect(resolveHomeRole([], null)).toBeNull();
  });
  it("has workspace metadata for every role", () => {
    for (const r of ROLES) expect(ROLE_META[r].home).toBe(`/${r}`);
  });
});

describe("auth schemas", () => {
  it("normalises phone input to E.164", () => {
    expect(sendOtpSchema.parse({ phone: "0770123456" })).toEqual({ phone: "+231770123456" });
  });
  it("requires a 6-digit code", () => {
    expect(verifyOtpSchema.safeParse({ phone: "+231770123456", token: "12345" }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ phone: "+231770123456", token: "123456" }).success).toBe(true);
  });
});

describe("workspace navigation", () => {
  it("gives every role an overview available in the current phase", () => {
    for (const r of ROLES) expect(NAV[r][0]).toMatchObject({ segment: "", phase: 1 });
  });
  it("keeps at most 4 primary items for the phone tab bar", () => {
    for (const r of ROLES) expect(NAV[r].filter((i) => i.primary).length).toBeLessThanOrEqual(4);
  });
  it("uses unique segments", () => {
    for (const r of ROLES) {
      const segs = NAV[r].map((i) => i.segment);
      expect(new Set(segs).size).toBe(segs.length);
    }
    expect(CURRENT_PHASE).toBeGreaterThanOrEqual(1);
  });
});

import { passwordSignInSchema } from "@/features/auth/schemas";

describe("password sign-in schema", () => {
  it("normalises email and requires a password", () => {
    expect(passwordSignInSchema.parse({ email: "  Owner@Example.COM ", password: "longenough" }).email).toBe("owner@example.com");
    expect(passwordSignInSchema.safeParse({ email: "nope", password: "longenough" }).success).toBe(false);
    expect(passwordSignInSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});
