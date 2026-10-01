import { beforeEach, describe, expect, it } from "vitest";
import { clientKey, hit, peek, resetRateLimits } from "@/lib/security/rate-limit";

beforeEach(() => resetRateLimits());

describe("rate limiter", () => {
  it("allows up to the limit then blocks, and reports when to retry", () => {
    for (let i = 0; i < 3; i++) expect(hit("k", 3, 60_000, 1000).allowed).toBe(true);
    const r = hit("k", 3, 60_000, 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBe(60);
  });
  it("starts a fresh window after it expires", () => {
    for (let i = 0; i < 4; i++) hit("k", 3, 1000, 0);
    expect(hit("k", 3, 1000, 1001).allowed).toBe(true);
  });
  it("keys are independent", () => {
    for (let i = 0; i < 5; i++) hit("a", 2, 1000, 0);
    expect(hit("b", 2, 1000, 0).allowed).toBe(true);
  });
  it("peek does not count", () => {
    hit("k", 1, 1000, 0);
    expect(peek("k", 1, 10).allowed).toBe(false);
    expect(peek("k", 2, 10).allowed).toBe(true);
    expect(peek("k", 2, 10).remaining).toBe(1);
  });
  it("takes the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "41.1.2.3, 10.0.0.1" }))).toBe("41.1.2.3");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
