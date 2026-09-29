"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import type { Json } from "@/lib/db/types";

export type SettingState = ActionResult<null> | null;

const settingSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  kind: z.enum(["number", "string", "boolean"]),
  value: z.string().trim().min(1, "Enter a value.").max(200),
});

function coerce(kind: "number" | "string" | "boolean", raw: string): Json | undefined {
  if (kind === "number") {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return undefined;
    return Number(raw);
  }
  if (kind === "boolean") return raw === "true" ? true : raw === "false" ? false : undefined;
  return raw;
}

/**
 * Updates a platform setting. Authorisation happens twice on purpose: the
 * server checks the admin role for a fast, friendly error, and the
 * `update_platform_setting` database function re-checks it, enforces type and
 * bounds, and writes the audit entry in the same transaction.
 */
export async function updateSetting(_prev: SettingState, formData: FormData): Promise<SettingState> {
  await requireRole("admin");

  const parsed = settingSchema.safeParse({
    key: formData.get("key"),
    kind: formData.get("kind"),
    value: formData.get("value"),
  });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid value.");

  const value = coerce(parsed.data.kind, parsed.data.value);
  if (value === undefined) return fail("VALIDATION", `Enter a valid ${parsed.data.kind}.`);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("NOT_CONFIGURED", "Supabase is not configured.");

  const { error } = await supabase.rpc("update_platform_setting", { p_key: parsed.data.key, p_value: value });
  if (error) {
    logger.warn("admin.setting_update_failed", { key: parsed.data.key, code: error.code });
    // check_violation / insufficient_privilege carry safe, human-written messages from the DB function.
    if (error.code === "23514" || error.code === "42501" || error.code === "P0002") return fail("VALIDATION", error.message);
    return fail("INTERNAL", "The setting couldn't be saved. Please try again.");
  }

  revalidatePath("/admin", "layout");
  return ok(null, "Saved. The change has been recorded in the audit log.");
}
