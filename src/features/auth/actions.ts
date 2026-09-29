"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { safeNextPath } from "@/lib/security/redirect";
import { isRole, resolveHomeRole, ROLE_META } from "@/lib/auth/roles";
import { maskPhone } from "@/lib/validation/phone";
import { isTemporaryAccessEnabled } from "@/config/env.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { passwordSignInSchema, sendOtpSchema, verifyOtpSchema } from "./schemas";

export type SendOtpState = ActionResult<{ phone: string; masked: string; sentAt: number }> | null;
export type VerifyOtpState = ActionResult<null> | null;
export type PasswordSignInState = ActionResult<null> | null;

const NOT_CONFIGURED = "Sign-in isn't connected yet. An administrator needs to link the Supabase project.";

/** Step 1 — send a one-time code by SMS (delivered by Supabase Auth's SMS provider). */
export async function sendOtp(_prev: SendOtpState, formData: FormData): Promise<SendOtpState> {
  const parsed = sendOtpSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your phone number.";
    return fail("VALIDATION", message, { phone: message });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", NOT_CONFIGURED);

  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
    options: { channel: "sms", shouldCreateUser: true },
  });

  if (error) {
    logger.warn("auth.otp_send_failed", { status: error.status, errorCode: error.code });
    if (error.status === 429) {
      return fail("RATE_LIMITED", "Too many codes requested. Please wait a minute and try again.");
    }
    return fail("PROVIDER_ERROR", "We couldn't send a code to that number. Check it and try again.");
  }

  logger.info("auth.otp_sent");
  return ok({ phone: parsed.data.phone, masked: maskPhone(parsed.data.phone), sentAt: Date.now() });
}

/** Step 2 — verify the code, then route the user to onboarding or their workspace. */
export async function verifyOtp(_prev: VerifyOtpState, formData: FormData): Promise<VerifyOtpState> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
    next: formData.get("next") || undefined,
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? "Check the code.", { token: issue?.message });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", NOT_CONFIGURED);

  const { data, error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });

  if (error || !data.user) {
    logger.warn("auth.otp_verify_failed", { status: error?.status, errorCode: error?.code });
    if (error?.status === 429) return fail("RATE_LIMITED", "Too many attempts. Wait a minute, then request a new code.");
    return fail("VALIDATION", "That code is wrong or has expired.", { token: "That code is wrong or has expired." });
  }

  logger.info("auth.signed_in", { userId: data.user.id, method: "sms" });
  return redirectAfterSignIn(supabase, data.user.id, parsed.data.next, parsed.data.role);
}

/**
 * TEMPORARY ACCESS — email + password sign-in for pre-provisioned accounts,
 * used while no SMS provider is configured. Only works when the server env
 * flag DEMO_ACCESS_ENABLED=true; the form is hidden and this action refuses
 * otherwise. New accounts cannot be created this way (sign-in only).
 */
export async function signInWithPassword(_prev: PasswordSignInState, formData: FormData): Promise<PasswordSignInState> {
  if (!isTemporaryAccessEnabled()) {
    return fail("FORBIDDEN", "Password sign-in is turned off.");
  }
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail("VALIDATION", "Check the highlighted fields.", fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", NOT_CONFIGURED);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    logger.warn("auth.password_sign_in_failed", { status: error?.status, errorCode: error?.code });
    if (error?.status === 429) return fail("RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
    return fail("VALIDATION", "Email or password is incorrect.");
  }

  logger.info("auth.signed_in", { userId: data.user.id, method: "password" });
  return redirectAfterSignIn(supabase, data.user.id, parsed.data.next);
}

/** Shared post-sign-in routing: onboarding for new accounts, otherwise the right workspace. */
async function redirectAfterSignIn(
  supabase: SupabaseClient<Database>,
  userId: string,
  next?: string,
  role?: string,
): Promise<never> {
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("status", "active"),
    supabase.from("profiles").select("default_role, onboarded_at").eq("id", userId).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role).filter(isRole);

  if (roles.length === 0 || !profile?.onboarded_at) {
    const q = new URLSearchParams();
    if (role) q.set("role", role);
    if (next) q.set("next", safeNextPath(next, "/"));
    redirect(`/onboarding${q.size ? `?${q}` : ""}`);
  }

  const home = resolveHomeRole(roles, profile?.default_role ?? null);
  const fallback = home ? ROLE_META[home].home : "/";
  const destination = safeNextPath(next, fallback);
  redirect(destination === "/" ? fallback : destination);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
