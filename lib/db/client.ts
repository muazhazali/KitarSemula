import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Cloudflare bindings for this app. Declared here so the code typechecks even
 * before `wrangler types` has generated cloudflare-env.d.ts.
 */
export interface AppEnv {
  DB: D1Database;
  PHOTOS: R2Bucket;
  /** Optional R2 custom domain, e.g. https://photos.kitarsemula.app */
  PHOTO_PUBLIC_BASE_URL?: string;
  /** Optional Turnstile secret; when unset, verification is skipped. */
  TURNSTILE_SECRET_KEY?: string;
  PHOTO_RATE_LIMITER?: RateLimit;
  VOTE_RATE_LIMITER?: RateLimit;
}

/**
 * Returns the Cloudflare bindings, or null when running somewhere without them
 * (e.g. `next dev` without initOpenNextCloudflareForDev). Callers should treat
 * null as "storage unavailable" and respond 503 rather than crashing.
 */
export function getAppEnv(): AppEnv | null {
  try {
    const { env } = getCloudflareContext();
    return env as unknown as AppEnv;
  } catch {
    return null;
  }
}
