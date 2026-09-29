/**
 * Guards against open redirects: only same-origin, absolute paths are allowed
 * as post-sign-in destinations. Anything else falls back to `fallback`.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//evil.com" and "/\evil.com" are protocol-relative in browsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://gbana.local");
    if (url.origin !== "http://gbana.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
