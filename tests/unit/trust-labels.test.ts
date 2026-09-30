import { describe, expect, it } from "vitest";
import {
  autoReleaseHoursLeft,
  averageRating,
  canOpenDispute,
  carrierStage,
  checkpointWaitSeconds,
  DISPUTE_KIND,
  DISPUTE_STATUS,
  formatDeliveryCode,
  isDeliveryCode,
  isLiveDispute,
  maxPartialRefund,
  normalizeDeliveryCode,
  reviewWindowOpen,
  roundCoord,
} from "@/lib/trust/labels";
import { buildEvidencePath, isValidEvidencePath, maxEvidenceBytes } from "@/lib/storage/evidence";

const D = "11111111-2222-3333-4444-555555555555";

describe("delivery code helpers", () => {
  it("keeps only six digits", () => {
    expect(normalizeDeliveryCode("482-913 77")).toBe("482913");
    expect(isDeliveryCode("482913")).toBe(true);
    expect(isDeliveryCode("48291")).toBe(false);
    expect(isDeliveryCode("48291a")).toBe(false);
  });
  it("formats with a gap", () => expect(formatDeliveryCode("482913")).toBe("482 913"));
});

describe("carrier stage", () => {
  it("follows the delivery row", () => {
    expect(carrierStage(null)).toBe("awaiting_pickup");
    expect(carrierStage({ picked_up_at: "x", arrived_at: null, completed_at: null })).toBe("in_transit");
    expect(carrierStage({ picked_up_at: "x", arrived_at: "y", completed_at: null })).toBe("arrived");
    expect(carrierStage({ picked_up_at: "x", arrived_at: "y", completed_at: "z" })).toBe("completed");
  });
});

describe("timers", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("counts hours until auto-release, never negative", () => {
    expect(autoReleaseHoursLeft("2026-10-10T00:00:00Z", 72, now)).toBe(60);
    expect(autoReleaseHoursLeft("2026-10-01T00:00:00Z", 72, now)).toBe(0);
  });
  it("counts seconds until the next checkpoint", () => {
    expect(checkpointWaitSeconds(null, 120, now)).toBe(0);
    expect(checkpointWaitSeconds("2026-10-10T11:59:00Z", 120, now)).toBe(60);
    expect(checkpointWaitSeconds("2026-10-10T11:50:00Z", 120, now)).toBe(0);
  });
  it("rounds coordinates to about 11 metres", () => expect(roundCoord(6.300774)).toBe(6.3008));
});

describe("disputes", () => {
  it("can open only while money is in escrow and goods are moving", () => {
    for (const s of ["paid_escrow", "in_transit", "awaiting_confirmation"]) expect(canOpenDispute(s)).toBe(true);
    for (const s of ["completed", "delivered", "disputed", "cancelled", "awaiting_payment"]) expect(canOpenDispute(s)).toBe(false);
  });
  it("labels every kind and status", () => {
    for (const k of Object.values(DISPUTE_KIND)) expect(k.label && k.hint).toBeTruthy();
    expect(isLiveDispute("open")).toBe(true);
    expect(isLiveDispute("under_review")).toBe(true);
    for (const s of ["resolved", "rejected", "refunded", "partial_refund"] as const) expect(isLiveDispute(s)).toBe(false);
    expect(Object.keys(DISPUTE_STATUS)).toHaveLength(6);
  });
  it("caps a partial refund below the goods value", () => {
    expect(maxPartialRefund(25000)).toBe(24999);
    expect(maxPartialRefund(0)).toBe(0);
  });
});

describe("reviews", () => {
  it("averages to one decimal", () => {
    expect(averageRating(0, 0)).toBeNull();
    expect(averageRating(14, 3)).toBe(4.7);
  });
  it("closes after the window", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    expect(reviewWindowOpen("2026-10-05T00:00:00Z", 30, now)).toBe(true);
    expect(reviewWindowOpen("2026-09-01T00:00:00Z", 30, now)).toBe(false);
    expect(reviewWindowOpen(null, 30, now)).toBe(false);
  });
});

describe("evidence paths", () => {
  it("builds and validates {dispute}/{uuid}.{ext}", () => {
    const p = buildEvidencePath(D, "video/mp4");
    expect(p.startsWith(`${D}/`)).toBe(true);
    expect(p.endsWith(".mp4")).toBe(true);
    expect(isValidEvidencePath(p, D)).toBe(true);
  });
  it("rejects other folders, extensions and traversal", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(isValidEvidencePath(`${D}/${id}.exe`, D)).toBe(false);
    expect(isValidEvidencePath(`${id}/${id}.jpg`, D)).toBe(false);
    expect(isValidEvidencePath(`${D}/../${id}.jpg`, D)).toBe(false);
    expect(isValidEvidencePath(`${D}/${id}.jpg`, "not-a-uuid")).toBe(false);
  });
  it("allows bigger videos than photos", () => expect(maxEvidenceBytes("video/mp4")).toBeGreaterThan(maxEvidenceBytes("image/jpeg")));
});
