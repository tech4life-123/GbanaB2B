"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { ROLE_META } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/security/redirect";
import { addRoleSchema, onboardingSchema } from "@/features/auth/schemas";

export type OnboardingState = ActionResult<null> | null;

/**
 * Completes onboarding through the `complete_onboarding` database function,
 * which validates the role (buyer/seller/carrier only), writes the profile and
 * role atomically, and records an audit entry. The client never writes
 * user_roles directly.
 */
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail("VALIDATION", "Please fix the highlighted fields.", fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", "Accounts aren't connected yet.");

  const { error } = await supabase.rpc("complete_onboarding", {
    p_full_name: parsed.data.fullName,
    p_role: parsed.data.role,
  });
  if (error) {
    logger.error("onboarding.failed", { code: error.code, message: error.message });
    return fail("INTERNAL", error.code === "42501" ? error.message : "We couldn't save your details. Please try again.");
  }

  revalidatePath("/", "layout");
  const next = safeNextPath(formData.get("next"), "");
  redirect(next || ROLE_META[parsed.data.role].home);
}

/** Adds another self-assignable role to an existing account. */
export async function addRole(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = addRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return fail("VALIDATION", "Choose a role to add.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", "Accounts aren't connected yet.");

  const { error } = await supabase.rpc("request_role", { p_role: parsed.data.role });
  if (error) {
    logger.warn("roles.request_failed", { code: error.code });
    return fail("FORBIDDEN", error.code === "42501" ? error.message : "We couldn't add that role. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect(ROLE_META[parsed.data.role].home);
}

/** Switches which workspace opens by default. */
export async function setDefaultRole(formData: FormData): Promise<void> {
  const parsed = addRoleSchema.safeParse({ role: formData.get("role") });
  const supabase = await createSupabaseServerClient();
  if (!parsed.success || !supabase) return;
  const { error } = await supabase.rpc("set_default_role", { p_role: parsed.data.role });
  if (error) logger.warn("roles.set_default_failed", { code: error.code });
  revalidatePath("/", "layout");
}
