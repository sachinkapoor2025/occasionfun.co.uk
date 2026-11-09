type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter for single-instance deployments.
 * For multi-instance Amplify/Lambda production, replace with a shared store
 * (e.g. DynamoDB or Redis) before handling real enquiry volume.
 */
export function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 15 * 60 * 1000,
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { allowed: true };
}
