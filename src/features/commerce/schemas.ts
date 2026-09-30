import { z } from "zod";
import { Constants } from "@/lib/db/database.types";
import { normalizePhone } from "@/lib/validation/phone";
import { COUNTIES } from "@/features/marketplace/constants";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

export const quantitySchema = z.coerce
  .number({ error: "Enter a quantity." })
  .int("Enter a whole number.")
  .min(1, "Enter a quantity of at least 1.")
  .max(10_000_000, "That quantity is too large.");

export const addToCartSchema = z.object({ product_id: uuid, quantity: quantitySchema });
export const cartLineSchema = z.object({ line_id: uuid, quantity: quantitySchema });

export const addressSchema = z.object({
  label: z.string().trim().min(1, "Give this address a short name, like Shop or Warehouse.").max(40),
  contact_name: z.string().trim().min(2, "Who receives the goods?").max(120),
  contact_phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p.ok) {
        ctx.addIssue({ code: "custom", message: p.error });
        return z.NEVER;
      }
      return p.e164;
    }),
  county: z.enum(COUNTIES, { error: "Choose a county." }),
  town: z.string().trim().min(2, "Enter the town or community.").max(80),
  street: optionalText(200),
  landmark: optionalText(200),
  is_default: z.boolean(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  address_id: uuid.or(z.literal("")).refine((v) => v !== "", "Choose a delivery address."),
  business_name: optionalText(120),
  note: optionalText(500),
});

export const transitionSchema = z.object({
  order_id: uuid,
  to: z.enum(Constants.public.Enums.order_status),
  note: optionalText(500),
  version: z.coerce.number().int().positive().optional(),
});

export { uuid as uuidSchema };
