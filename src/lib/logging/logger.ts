/**
 * Structured JSON logger. Vercel captures stdout, so one JSON object per line
 * is enough to search and alert on. Sensitive keys are redacted before
 * anything is written — phone numbers, OTPs, tokens and secrets never belong
 * in logs.
 */

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /(pass(word)?|secret|token|otp|code|authorization|cookie|api[_-]?key|phone|pin)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1),
    ]),
  );
}

function threshold(): number {
  const configured = (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
  return ORDER[configured] ?? ORDER.info;
}

function write(level: Level, event: string, context?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(entry, (_k, v) =>
    v instanceof Error ? { name: v.name, message: v.message } : v,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, ctx?: Record<string, unknown>) => write("debug", event, ctx),
  info: (event: string, ctx?: Record<string, unknown>) => write("info", event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => write("warn", event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => write("error", event, ctx),
};
