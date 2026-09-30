import { describe, expect, it } from "vitest";
import { formatEta, isValidPlate, normalizePlate, onboardingGaps, timeLeft, vehicleClassFor, vehicleFits } from "@/lib/freight";
import { buildDocumentPath, isValidDocumentPath } from "@/lib/storage/documents";

describe("vehicle class (mirror of public.vehicle_class_for)", () => {
  it("uses the spec thresholds", () => {
    expect(vehicleClassFor(1)).toBe("small");
    expect(vehicleClassFor(300)).toBe("small");
    expect(vehicleClassFor(301)).toBe("medium");
    expect(vehicleClassFor(3000)).toBe("medium");
    expect(vehicleClassFor(3001)).toBe("large");
    expect(vehicleClassFor(30000)).toBe("large");
  });
});

describe("vehicle fit (mirror of public.vehicle_fits_rfq)", () => {
  const truck = { payloadKg: 4000, volumeM3: 20, isActive: true, isVerified: true };
  it("compares numeric payload, not the class", () => {
    expect(vehicleFits(truck, { weightG: 4_000_000, volumeCm3: null })).toBe(true);
    expect(vehicleFits(truck, { weightG: 4_000_001, volumeCm3: null })).toBe(false);
  });
  it("checks volume only when both are known", () => {
    expect(vehicleFits(truck, { weightG: 1000, volumeCm3: 21_000_000 })).toBe(false);
    expect(vehicleFits({ ...truck, volumeM3: null }, { weightG: 1000, volumeCm3: 21_000_000 })).toBe(true);
  });
  it("needs an active, admin-verified vehicle", () => {
    expect(vehicleFits({ ...truck, isVerified: false }, { weightG: 1000, volumeCm3: null })).toBe(false);
    expect(vehicleFits({ ...truck, isActive: false }, { weightG: 1000, volumeCm3: null })).toBe(false);
  });
});

describe("plates", () => {
  it("normalises like the database trigger", () => {
    expect(normalizePlate(" ab 1234 ")).toBe("AB1234");
    expect(isValidPlate("A-1234")).toBe(true);
    expect(isValidPlate("ab")).toBe(false);
    expect(isValidPlate("AB/1234")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats travel time", () => {
    expect(formatEta(10)).toBe("10 h");
    expect(formatEta(24)).toBe("1 day");
    expect(formatEta(30)).toBe("1 day 6 h");
    expect(formatEta(72)).toBe("3 days");
  });
  it("counts down the bidding window", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(timeLeft("2026-10-01T09:59:00Z", now)).toMatchObject({ closed: true });
    expect(timeLeft("2026-10-01T10:30:00Z", now)).toMatchObject({ label: "30 min left", urgent: true });
    expect(timeLeft("2026-10-02T10:00:00Z", now)).toMatchObject({ label: "24 h left", urgent: false });
    expect(timeLeft("2026-10-05T10:00:00Z", now).label).toBe("4 days left");
  });
});

describe("onboarding gaps (mirror of submit_carrier_for_review)", () => {
  it("lists what is missing", () => {
    expect(onboardingGaps({ hasProfile: false, activeVehicles: 0, documents: [] })).toHaveLength(4);
    expect(onboardingGaps({ hasProfile: true, activeVehicles: 1, documents: ["driver_license", "passport"] })).toEqual([]);
    expect(onboardingGaps({ hasProfile: true, activeVehicles: 1, documents: ["driver_license"] })).toEqual(["Upload your national ID or passport"]);
  });
});


describe("private document paths", () => {
  const me = "40000000-0000-4000-8000-00000000000c";
  it("builds paths inside the carrier's own folder", () => {
    const p = buildDocumentPath(me, "application/pdf");
    expect(p.startsWith(`${me}/`)).toBe(true);
    expect(isValidDocumentPath(p, me)).toBe(true);
  });
  it("rejects other folders, traversal and odd extensions", () => {
    expect(isValidDocumentPath(`40000000-0000-4000-8000-00000000000d/${crypto.randomUUID()}.jpg`, me)).toBe(false);
    expect(isValidDocumentPath(`${me}/../x/${crypto.randomUUID()}.jpg`, me)).toBe(false);
    expect(isValidDocumentPath(`${me}/${crypto.randomUUID()}.exe`, me)).toBe(false);
  });
});
