/**
 * Freight exchange vocabulary and pure helpers shared by carrier, buyer and
 * admin screens. The database decides eligibility and bid rules; these
 * mirror them for labels, previews and instant form feedback.
 */
import type { Tone } from "@/components/ui/badge";
import type { Enums } from "@/lib/db/database.types";

export type CarrierStatus = Enums<"carrier_verification_status">;
export type VehicleType = Enums<"vehicle_type">;
export type VehicleClass = Enums<"vehicle_class">;
export type DocumentType = Enums<"carrier_document_type">;
export type RfqStatus = Enums<"freight_rfq_status">;
export type BidStatus = Enums<"freight_bid_status">;

/** Same thresholds as public.vehicle_class_for(). Labels only — matching uses the numeric payload. */
export function vehicleClassFor(payloadKg: number): VehicleClass {
  if (payloadKg <= 300) return "small";
  if (payloadKg <= 3000) return "medium";
  return "large";
}

export const VEHICLE_CLASS: Record<VehicleClass, { label: string; range: string }> = {
  small: { label: "Small", range: "up to 300 kg" },
  medium: { label: "Medium", range: "301 – 3,000 kg" },
  large: { label: "Large", range: "over 3,000 kg" },
};

export const VEHICLE_TYPES: Record<VehicleType, string> = {
  motorbike: "Motorbike",
  tricycle: "Tricycle (keke)",
  pickup: "Pickup",
  van: "Van",
  box_truck: "Box truck",
  flatbed_truck: "Flatbed truck",
  tipper: "Tipper",
  container_truck: "Container truck",
  other: "Other",
};

export const DOCUMENT_TYPES: Record<DocumentType, { label: string; hint: string }> = {
  driver_license: { label: "Driver's licence", hint: "Front of your valid licence" },
  national_id: { label: "National ID", hint: "Liberian national ID card" },
  passport: { label: "Passport", hint: "Photo page" },
  vehicle_registration: { label: "Vehicle registration", hint: "Registration for one of your vehicles" },
  vehicle_insurance: { label: "Vehicle insurance", hint: "Current insurance certificate" },
  other: { label: "Other", hint: "Anything else that helps us verify you" },
};

export const CARRIER_STATUS: Record<CarrierStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Not submitted", tone: "neutral", hint: "Finish your profile, add a vehicle and upload your documents, then submit." },
  under_review: { label: "Under review", tone: "signal", hint: "Our team is checking your documents. This usually takes 1–2 working days." },
  verified: { label: "Verified carrier", tone: "escrow", hint: "You can see and bid on loads that fit your vehicles and routes." },
  rejected: { label: "Needs changes", tone: "danger", hint: "Fix what our team asked for, then submit again." },
  suspended: { label: "Suspended", tone: "danger", hint: "You can't bid while suspended. Contact GbanaB2B support." },
};

export const RFQ_STATUS: Record<RfqStatus, { label: string; tone: Tone }> = {
  open: { label: "Taking bids", tone: "signal" },
  awarded: { label: "Carrier chosen", tone: "escrow" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

export const BID_STATUS: Record<BidStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Live", tone: "info" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  accepted: { label: "Won", tone: "escrow" },
  rejected: { label: "Not chosen", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

/** Same normalisation as the vehicles_guard trigger: uppercase, no spaces. */
export function normalizePlate(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidPlate(input: string): boolean {
  return /^[A-Z0-9-]{3,12}$/.test(normalizePlate(input));
}

/** "10 h", "1 day 6 h", "3 days" */
export function formatEta(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return `${d} ${d === 1 ? "day" : "days"}${h ? ` ${h} h` : ""}`;
}

/** Time left until `closesAt`, e.g. "41 h left", "25 min left", or "Closed". */
export function timeLeft(closesAt: string | Date, now: Date = new Date()): { label: string; closed: boolean; urgent: boolean } {
  const ms = new Date(closesAt).getTime() - now.getTime();
  if (ms <= 0) return { label: "Bidding closed", closed: true, urgent: false };
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return { label: `${mins} min left`, closed: false, urgent: true };
  const hours = Math.floor(mins / 60);
  if (hours < 48) return { label: `${hours} h left`, closed: false, urgent: hours < 6 };
  return { label: `${Math.floor(hours / 24)} days left`, closed: false, urgent: false };
}

/** Whether a vehicle can carry the cargo — same rule as public.vehicle_fits_rfq(). */
export function vehicleFits(
  vehicle: { payloadKg: number; volumeM3: number | null; isActive: boolean; isVerified: boolean },
  cargo: { weightG: number; volumeCm3: number | null },
): boolean {
  if (!vehicle.isActive || !vehicle.isVerified) return false;
  if (vehicle.payloadKg * 1000 < cargo.weightG) return false;
  if (cargo.volumeCm3 !== null && vehicle.volumeM3 !== null && vehicle.volumeM3 * 1_000_000 < cargo.volumeCm3) return false;
  return true;
}

/** What a carrier still needs before they can submit for review. */
export function onboardingGaps(input: {
  hasProfile: boolean;
  activeVehicles: number;
  documents: DocumentType[];
}): string[] {
  const gaps: string[] = [];
  if (!input.hasProfile) gaps.push("Complete your driver profile");
  if (input.activeVehicles === 0) gaps.push("Add at least one vehicle");
  if (!input.documents.includes("driver_license")) gaps.push("Upload your driver's licence");
  if (!input.documents.some((d) => d === "national_id" || d === "passport")) gaps.push("Upload your national ID or passport");
  return gaps;
}
