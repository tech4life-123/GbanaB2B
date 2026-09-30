import { z } from "zod";
import { Constants } from "@/lib/db/database.types";
import { normalizePhone } from "@/lib/validation/phone";
import { COUNTIES, ORIGIN_COUNTRIES } from "@/features/marketplace/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const p = normalizePhone(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: p.error });
      return z.NEVER;
    }
    return p.e164;
  });

export const businessSchema = z.object({
  trading_name: z.string().trim().min(2, "Enter your business name.").max(120),
  legal_name: optionalText(160),
  business_type: z.enum(Constants.public.Enums.business_type, { error: "Choose a business type." }),
  county: z.enum(COUNTIES, { error: "Choose a county." }),
  town: z.string().trim().min(2, "Enter your town or community.").max(80),
  address_line: optionalText(200),
  description: optionalText(2000),
  contact_phone: optionalPhone,
  whatsapp_phone: optionalPhone,
  registration_number: optionalText(60),
});
export type BusinessInput = z.infer<typeof businessSchema>;

export const listingBasicsSchema = z.object({
  title: z.string().trim().min(3, "Give the product a clear title.").max(140),
  category_id: z.uuid("Choose a category."),
  unit_label: z.string().trim().min(1, "Say what one unit is, e.g. \"25 kg bag\".").max(40),
  packaging_type: z.enum(Constants.public.Enums.packaging_type),
  description: optionalText(5000),
  sku: optionalText(60),
  origin_country: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v in ORIGIN_COUNTRIES, "Choose a country from the list."),
});
export type ListingBasicsInput = z.infer<typeof listingBasicsSchema>;

const decimalToInt = (factor: number, min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/,/g, ""));
      const scaled = Math.round(n * factor);
      if (!Number.isFinite(n) || n <= 0 || scaled < min || scaled > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return scaled;
    });

export const logisticsSchema = z.object({
  unit_weight_g: decimalToInt(1000, 1, 50_000_000, "Enter the weight of one unit in kg (e.g. 25.3)."),
  length_mm: decimalToInt(10, 1, 100_000, "Enter length in cm."),
  width_mm: decimalToInt(10, 1, 100_000, "Enter width in cm."),
  height_mm: decimalToInt(10, 1, 100_000, "Enter height in cm."),
  is_fragile: z.boolean(),
  is_stackable: z.boolean(),
  max_stack_layers: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number.parseInt(v, 10);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        ctx.addIssue({ code: "custom", message: "Enter a whole number between 1 and 100." });
        return z.NEVER;
      }
      return n;
    }),
  handling_notes: optionalText(500),
});

export const pricingSchema = z.object({
  currency: z.enum(["USD", "LRD"]),
  moq: z.coerce.number({ error: "Enter the minimum order." }).int("Use a whole number.").min(1).max(1_000_000),
  quantity_available: z.coerce.number({ error: "Enter the quantity you have." }).int("Use a whole number.").min(0).max(100_000_000),
  tiers: z
    .array(
      z.object({
        maxQty: z.number().int().positive().nullable(),
        unitPriceMinor: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10),
});

export const specsSchema = z
  .array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(200) }))
  .max(30, "Add up to 30 specifications.");

export const statusSchema = z.enum(["active", "paused", "archived"]);
