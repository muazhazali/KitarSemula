import type { AppEnv } from './db/client';

export interface RateLimitOutcome {
  allowed: boolean;
  /** Whether a limiter was actually consulted (false when unbound, e.g. local dev). */
  enforced: boolean;
}

/**
 * Checks a rate-limit binding for the given key. When the binding is missing
 * (local dev, or an un-configured deploy) the request is allowed so the app
 * stays usable; the limit only applies once the binding exists.
 */
export async function checkRateLimit(
  limiter: AppEnv['PHOTO_RATE_LIMITER'],
  key: string,
): Promise<RateLimitOutcome> {
  if (!limiter) return { allowed: true, enforced: false };
  const { success } = await limiter.limit({ key });
  return { allowed: success, enforced: true };
}

/** Best-effort client identifier for rate limiting. */
export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return `${scope}:${ip}`;
}
