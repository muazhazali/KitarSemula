import type { AppEnv } from './db/client';
import { isProduction } from './env';

export interface RateLimitOutcome {
  allowed: boolean;
  /** Whether a limiter was actually consulted (false when unbound). */
  enforced: boolean;
}

/**
 * Checks a rate-limit binding for the given key.
 *
 * When the binding is missing we allow the request in development so `next dev`
 * stays usable, but reject in production: a missing binding must not silently
 * disable abuse protection on a public write endpoint.
 */
export async function checkRateLimit(
  limiter: AppEnv['PHOTO_RATE_LIMITER'],
  key: string,
): Promise<RateLimitOutcome> {
  if (!limiter) {
    return { allowed: !isProduction(), enforced: false };
  }
  const { success } = await limiter.limit({ key });
  return { allowed: success, enforced: true };
}

/**
 * Best-effort client identifier for rate limiting. `cf-connecting-ip` is set by
 * Cloudflare and cannot be spoofed through the edge; the forwarded-for fallback
 * is only for local development.
 */
export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return `${scope}:${ip}`;
}
