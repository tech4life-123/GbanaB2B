/**
 * Error model shared by server actions and route handlers.
 *
 * Server actions return `ActionResult` rather than throwing, so forms can show
 * a helpful message. Internal details stay in logs; users see `message` only.
 */

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type FieldErrors = Partial<Record<string, string>>;

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(code: ErrorCode, message: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, code, message, fieldErrors };
}

/** Maps any thrown value to a safe, user-facing failure. */
export function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) return fail(error.code, error.message);
  return fail("INTERNAL", "Something went wrong on our side. Please try again.");
}
