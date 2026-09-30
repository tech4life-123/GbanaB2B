import "server-only";
import type { ZodType } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { AiProviderError } from "@/lib/ai/provider";
import { getAiProvider } from "@/lib/ai/server";
import { parseModelJson } from "@/lib/ai/json";

export type Assistant = "buyer" | "seller" | "freight" | "admin" | "dispute_summary";

export interface AiStatus {
  /** A provider key exists on the server. */
  configured: boolean;
  /** An admin has switched the assistants on. */
  enabled: boolean;
  maxInputChars: number;
}

export async function getAiStatus(): Promise<AiStatus> {
  const { isAiConfigured } = await import("@/lib/ai/server");
  const db = await createSupabaseServerClient();
  let enabled = false;
  let maxInputChars = 6000;
  if (db) {
    const { data } = await db.from("platform_settings").select("key, value").in("key", ["ai.enabled", "ai.max_input_chars"]);
    for (const row of data ?? []) {
      const n = Number(row.value);
      if (row.key === "ai.enabled") enabled = n === 1;
      if (row.key === "ai.max_input_chars" && Number.isFinite(n) && n > 0) maxInputChars = n;
    }
  }
  return { configured: isAiConfigured(), enabled, maxInputChars };
}

export interface AiRun<T> {
  value: T;
  /** Requests left in the rolling 24 hours. */
  remaining: number;
}

/**
 * The only path from a request to a model. Order matters:
 *  1. no provider key → honest "not connected" (nothing is counted);
 *  2. the database takes quota — it also enforces the on/off switch and the
 *     caller's role, so a forged request can't get past the UI;
 *  3. the model is called; its reply must validate against our schema or it
 *     is discarded. Nothing the model says is ever executed.
 */
export async function runAssistant<T>(args: {
  assistant: Assistant;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<ActionResult<AiRun<T>>> {
  const provider = getAiProvider();
  if (!provider) return fail("NOT_CONFIGURED", "The AI assistants aren't connected yet. Ask an administrator to finish setting them up.");

  const db = await createSupabaseServerClient();
  if (!db) return fail("NOT_CONFIGURED", "The service isn't configured.");

  const quota = await db.rpc("ai_take_quota", { p_assistant: args.assistant });
  if (quota.error) return dbFailure(quota.error, "We couldn't start the assistant. Please try again.", "ai.quota_failed");

  try {
    const text = await provider.complete({ system: args.system, messages: [{ role: "user", content: args.user }], maxTokens: args.maxTokens });
    const value = parseModelJson(text, args.schema);
    if (!value) {
      logger.warn("ai.bad_shape", { assistant: args.assistant });
      return fail("PROVIDER_ERROR", "The assistant's answer couldn't be used. Please try again.");
    }
    return ok({ value, remaining: quota.data ?? 0 });
  } catch (e) {
    const kind = e instanceof AiProviderError ? e.kind : "unknown";
    logger.error("ai.provider_failed", { assistant: args.assistant, kind });
    if (kind === "timeout") return fail("PROVIDER_ERROR", "The assistant took too long. Please try again.");
    if (kind === "auth") return fail("NOT_CONFIGURED", "The AI connection needs attention. Ask an administrator.");
    return fail("PROVIDER_ERROR", "The assistant is unavailable right now. Please try again in a moment.");
  }
}
