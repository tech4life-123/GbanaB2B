import { z } from "zod";
import { normalizePhone } from "@/lib/validation/phone";
import { SELF_ASSIGNABLE_ROLES } from "@/lib/auth/roles";

export const phoneSchema = z
  .string({ error: "Enter your phone number." })
  .transform((value, ctx) => {
    const parsed = normalizePhone(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.error });
      return z.NEVER;
    }
    return parsed.e164;
  });

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Start again and re-enter your phone number."),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the SMS."),
  next: z.string().optional(),
  role: z.enum(SELF_ASSIGNABLE_ROLES).optional(),
});

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "That name is too long."),
  role: z.enum(SELF_ASSIGNABLE_ROLES, { error: "Choose how you'll use GbanaB2B." }),
});

export const addRoleSchema = z.object({
  role: z.enum(SELF_ASSIGNABLE_ROLES),
});
