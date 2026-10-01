/**
 * Small in-memory fixed-window limiter for public endpoints.
 *
 * Honest limits: each serverless instance keeps its own counters, so this is a
 * cheap first shield against bursts and scripts, not a global quota. The real
 * abuse controls are elsewhere (webhook signatures, database quotas, unique
 * keys). For a hard global limit add a Vercel Firewall rate-limit rule — see
 * docs/operations/runbook.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 5000;
const buckets = new Map<string, Bucket>();

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

/** Counts one hit for `key`. Fixed window of `windowMs`, at most `limit` hits. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) prune(now);
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

/** Reads the current state without counting. */
export function peek(key: string, limit: number, now = Date.now()): LimitResult {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { allowed: true, remaining: limit, retryAfter: 0 };
  return { allowed: b.count < limit, remaining: Math.max(0, limit - b.count), retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

function prune(now: number) {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  // Still full of live windows (an attack): drop the oldest half rather than grow without bound.
  if (buckets.size >= MAX_KEYS) {
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= MAX_KEYS / 2) break;
    }
  }
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}

/** Best-effort client address. On Vercel x-forwarded-for is set by the platform edge. */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}
