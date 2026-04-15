const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

export function rateLimit(
  key: string,
  identifier: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucketKey = `${key}:${identifier}`;
  const b = buckets.get(bucketKey);
  if (!b || b.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true };
}
