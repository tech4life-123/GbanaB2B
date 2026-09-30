"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Constants } from "@/lib/db/database.types";

export type AdminFormState = ActionResult<null> | null;

const reviewSchema = z.object({
  business_id: z.uuid(),
  verification: z.enum(Constants.public.Enums.business_verification_status),
  status: z.enum(Constants.public.Enums.business_status),
  note: z.string().trim().max(500),
});

/** Admin re-checked here and inside admin_review_business (which also audits). */
export async function reviewBusiness(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  const parsed = reviewSchema.safeParse({
    business_id: fd.get("business_id"),
    verification: fd.get("verification"),
    status: fd.get("status"),
    note: fd.get("note") ?? "",
  });
  if (!parsed.success) return fail("VALIDATION", "Check the review form.");
  const db = await createSupabaseServerClient();
  if (!db) return fail("NOT_CONFIGURED", "Supabase is not configured.");
  const { error } = await db.rpc("admin_review_business", {
    p_business: parsed.data.business_id,
    p_verification: parsed.data.verification,
    p_status: parsed.data.status,
    p_note: parsed.data.note || undefined,
  });
  if (error) {
    logger.warn("admin.review_business_failed", { code: error.code });
    return fail("VALIDATION", ["23514", "42501", "P0002"].includes(error.code) ? error.message : "The review couldn't be saved.");
  }
  revalidatePath("/admin/businesses");
  revalidatePath("/marketplace");
  return ok(null, "Review saved and recorded in the audit log.");
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
    .max(60),
  description: z.string().trim().max(300),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
});

export async function saveCategory(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  const parsed = categorySchema.safeParse({
    id: fd.get("id") || undefined,
    name: fd.get("name"),
    slug: fd.get("slug"),
    description: fd.get("description") ?? "",
    sort_order: fd.get("sort_order") || 100,
    is_active: fd.get("is_active") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return fail("VALIDATION", "Check the highlighted fields.", fieldErrors);
  }
  const db = await createSupabaseServerClient();
  if (!db) return fail("NOT_CONFIGURED", "Supabase is not configured.");
  const { id, slug, ...rest } = parsed.data;
  const values = { ...rest, description: rest.description || null };
  const { error } = id
    ? await db.from("product_categories").update(values).eq("id", id)
    : await db.from("product_categories").insert({ ...values, slug });
  if (error) {
    logger.warn("admin.save_category_failed", { code: error.code });
    return fail("VALIDATION", error.code === "23505" ? "A category with that slug already exists." : "The category couldn't be saved.");
  }
  revalidatePath("/admin/categories");
  revalidatePath("/marketplace");
  return ok(null, id ? "Category updated." : "Category created.");
}
