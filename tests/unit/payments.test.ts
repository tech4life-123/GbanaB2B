import { beforeAll, describe, expect, it, vi } from "vitest";
import { toDbStatus } from "@/lib/payments/status";

const SECRET = "test-secret-".padEnd(40, "x");
const REF = "11111111-2222-4333-8444-555555555555";

let sandbox: typeof import("@/lib/payments/providers/sandbox");

beforeAll(async () => {
  vi.stubEnv("SANDBOX_WEBHOOK_SECRET", SECRET);
  vi.resetModules();
  sandbox = await import("@/lib/payments/providers/sandbox");
});

function event(status: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  return sandbox.buildSandboxEvent({ reference: REF, providerTransactionId: "SBX-1", status, amountMinor: 29000, currency: "USD" });
}
const headersWith = (sig: string | null) => new Headers(sig ? { [sandbox.SANDBOX_SIGNATURE_HEADER]: sig } : {});

describe("sandbox provider webhook verification", () => {
  it("accepts a correctly signed event and exposes its fields", async () => {
    const e = event();
    const out = await sandbox.sandboxProvider.verifyWebhook(headersWith(e.signature), e.body);
    expect(out).toMatchObject({ reference: REF, status: "SUCCEEDED", providerTransactionId: "SBX-1", amount: { amountMinor: 29000, currency: "USD" } });
    expect(out?.eventId).toMatch(/^sbx-/);
  });

  it("rejects a missing signature", async () => {
    expect(await sandbox.sandboxProvider.verifyWebhook(headersWith(null), event().body)).toBeNull();
  });

  it("rejects a wrong signature of the right length", async () => {
    const e = event();
    const wrong = "0".repeat(e.signature!.length);
    expect(await sandbox.sandboxProvider.verifyWebhook(headersWith(wrong), e.body)).toBeNull();
  });

  it("rejects a body that was changed after signing (e.g. amount tampering)", async () => {
    const e = event();
    const tampered = e.body.replace("29000", "1");
    expect(await sandbox.sandboxProvider.verifyWebhook(headersWith(e.signature), tampered)).toBeNull();
  });

  it("rejects a correctly signed body that is not a valid event", async () => {
    const body = JSON.stringify({ hello: "world" });
    expect(await sandbox.sandboxProvider.verifyWebhook(headersWith(sandbox.signSandboxBody(body)), body)).toBeNull();
    const notJson = "not json";
    expect(await sandbox.sandboxProvider.verifyWebhook(headersWith(sandbox.signSandboxBody(notJson)), notJson)).toBeNull();
  });

  it("gives every generated event its own id so replays are detectable", () => {
    expect(JSON.parse(event().body).eventId).not.toBe(JSON.parse(event().body).eventId);
  });

  it("never reports success just from requesting a collection", async () => {
    const r = await sandbox.sandboxProvider.requestCollection({ reference: REF, idempotencyKey: "k".repeat(10), amount: { amountMinor: 1, currency: "USD" }, payerMsisdn: "+231770000000", description: "x" });
    expect(r.status).toBe("REQUIRES_CUSTOMER_ACTION");
    expect((await sandbox.sandboxProvider.getStatus(REF)).status).toBe("PENDING");
  });
});

describe("real providers without credentials", () => {
  it("refuse every call and accept no webhooks", async () => {
    const { unconfiguredProvider } = await import("@/lib/payments/providers/unconfigured");
    for (const id of ["mtn_momo_lr", "orange_money_lr"] as const) {
      const p = unconfiguredProvider(id);
      expect(p.isConfigured()).toBe(false);
      await expect(p.requestCollection({ reference: REF, idempotencyKey: "k".repeat(10), amount: { amountMinor: 1, currency: "USD" }, payerMsisdn: "+231770000000", description: "x" })).rejects.toThrow(/isn't connected/);
      expect(await p.verifyWebhook(new Headers(), "{}")).toBeNull();
    }
  });
});

describe("status mapping", () => {
  it("maps provider statuses to ours and never invents success", () => {
    expect(toDbStatus("SUCCEEDED")).toBe("succeeded");
    expect(toDbStatus("FAILED")).toBe("failed");
    expect(toDbStatus("CANCELLED")).toBe("cancelled");
    expect(toDbStatus("EXPIRED")).toBe("expired");
    expect(toDbStatus("PENDING")).toBe("pending");
    expect(toDbStatus("REQUIRES_CUSTOMER_ACTION")).toBe("pending");
  });
});
