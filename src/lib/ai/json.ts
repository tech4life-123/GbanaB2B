import type { ZodType } from "zod";

/**
 * Pulls the first balanced JSON object out of a model reply. Models sometimes
 * wrap JSON in prose or a code fence; we accept that but nothing else.
 */
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Extracts and validates. Returns null if the reply is not the shape we asked for. */
export function parseModelJson<T>(text: string, schema: ZodType<T>): T | null {
  const raw = extractJsonObject(text);
  if (raw === null) return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
