import { z } from "zod";
import { Constants } from "@/lib/db/database.types";
import { normalizePhone } from "@/lib/validation/phone";
import { COUNTIES } from "@/features/marketplace/constants";
import { isValidPlate, normalizePlate } from "@/lib/freight";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: p.error });
      return z.NEVER;
    }
    return p.e164;
  });

export const carrierProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name as it appears on your licence.").max(120),
  phone,
  address: z.string().trim().min(3, "Enter your address.").max(200),
  home_county: z.enum(COUNTIES, { error: "Choose your home county." }),
  home_town: z.string().trim().min(2, "Enter your town.").max(80),
  coverage_counties: z.array(z.enum(COUNTIES)).min(1, "Choose at least one county you drive to.").max(15),
  is_available: z.boolean(),
});

export const vehicleSchema = z.object({
  vehicle_type: z.enum(Constants.public.Enums.vehicle_type, { error: "Choose a vehicle type." }),
  plate_number: z
    .string()
    .transform(normalizePlate)
    .refine(isValidPlate, "Use letters, numbers and dashes only (3–12 characters)."),
  make_model: optionalText(80),
  year: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1970 || n > 2100) {
        ctx.addIssue({ code: "custom", message: "Enter a year like 2016." });
        return z.NEVER;
      }
      return n;
    }),
  payload_kg: z.coerce
    .number({ error: "Enter the maximum load in kg." })
    .int("Whole kilograms only.")
    .min(1, "Enter the maximum load in kg.")
    .max(60000, "Up to 60,000 kg."),
  cargo_volume_m3: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n >= 10000) {
        ctx.addIssue({ code: "custom", message: "Enter the cargo space in cubic metres, e.g. 18." });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  is_active: z.boolean(),
});

export const documentSchema = z.object({
  doc_type: z.enum(Constants.public.Enums.carrier_document_type),
  vehicle_id: uuid.nullable(),
  path: z.string().max(200),
  file_name: z.string().trim().min(1).max(160),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  size_bytes: z.number().int().min(1).max(5 * 1024 * 1024),
});

export const bidSchema = z.object({
  rfq_id: uuid,
  vehicle_id: uuid,
  amount: z.string().trim().min(1, "Enter your price."),
  eta_hours: z.coerce.number({ error: "Enter the travel time." }).int("Whole hours.").min(1, "At least 1 hour.").max(720, "Up to 720 hours."),
  delivery_date: z.iso.date({ error: "Choose a delivery date." }),
  note: optionalText(300),
});

export { uuid as uuidSchema };
