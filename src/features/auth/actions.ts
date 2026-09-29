"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { safeNextPath } from "@/lib/security/redirect";
import { isRole, resolveHomeRole, ROLE_META } from "@/lib/auth/roles";
import { maskPhone } from "@/lib/validation/phone";
import { sendOtpSchema, verifyOtpSchema } from "./schemas";

export type SendOtpState = ActionResult<{ phone: string; masked: string; sentAt: number }> | null;
export type VerifyOtpState = ActionResult<null> | null;

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

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("status", "active"),
    supabase.from("profiles").select("default_role, onboarded_at").eq("id", data.user.id).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role).filter(isRole);
  logger.info("auth.signed_in", { userId: data.user.id, roleCount: roles.length });

  if (roles.length === 0 || !profile?.onboarded_at) {
    const q = new URLSearchParams();
    if (parsed.data.role) q.set("role", parsed.data.role);
    if (parsed.data.next) q.set("next", safeNextPath(parsed.data.next, "/"));
    redirect(`/onboarding${q.size ? `?${q}` : ""}`);
  }

  const home = resolveHomeRole(roles, profile?.default_role ?? null);
  const fallback = home ? ROLE_META[home].home : "/";
  const destination = safeNextPath(parsed.data.next, fallback);
  redirect(destination === "/" ? fallback : destination);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
