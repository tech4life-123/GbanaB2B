import { fail, type ActionResult, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

type PgError = { code?: string; message: string };

/**
 * Database workflow functions and triggers raise human-written messages with
 * these SQLSTATEs, so they're safe to show. Anything else is logged and
 * replaced with `fallback`.
 */
const USER_FACING = new Set(["23514", "42501", "P0002", "22023"]);

export function dbFailure(error: PgError, fallback: string, event: string, uniqueMessage = "That's already saved."): ActionResult<never> {
  logger.warn(event, { code: error.code, message: error.message });
  if (error.code === "40001") return fail("CONFLICT", error.message);
  if (error.code === "23505") return fail("CONFLICT", uniqueMessage);
  if (error.code && USER_FACING.has(error.code)) return fail("VALIDATION", error.message);
  return fail("INTERNAL", fallback);
}

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

export function formText(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
