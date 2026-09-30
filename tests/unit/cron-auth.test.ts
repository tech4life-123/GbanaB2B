import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/jobs/cron-auth";

const SECRET = "a-long-random-secret-value";
const req = (auth?: string) => new Request("https://x.test/api/cron/sweep", { headers: auth ? { authorization: auth } : {} });

describe("cron authorization", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron(req(`Bearer ${SECRET}`), SECRET)).toBe(true);
    expect(isAuthorizedCron(req(`Bearer ${SECRET}x`), SECRET)).toBe(false);
    expect(isAuthorizedCron(req(SECRET), SECRET)).toBe(false);
    expect(isAuthorizedCron(req(), SECRET)).toBe(false);
  });
  it("refuses everything when no usable secret is configured", () => {
    expect(isAuthorizedCron(req("Bearer "), undefined)).toBe(false);
    expect(isAuthorizedCron(req("Bearer short"), "short")).toBe(false);
    expect(isAuthorizedCron(req("Bearer "), "")).toBe(false);
  });
});
