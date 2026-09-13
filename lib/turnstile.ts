/**
 * Cloudflare Turnstile server-side verification.
 *
 * The client-side widget alone provides no protection; the token it produces
 * must be validated against the Siteverify API. Tokens are single-use and
 * expire after 300 seconds.
 *
 * A successful response must also report the expected `action` and an approved
 * `hostname`, otherwise a token minted for another surface (or another domain
 * registered on the same widget) could be replayed here.
 *
 * Verification is skipped only outside production. In production a missing
 * secret is a configuration error and fails closed.
 */

import { isProduction } from './env';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const REQUEST_TIMEOUT_MS = 10_000;

export interface TurnstileResult {
  success: boolean;
  skipped?: boolean;
  errorCodes?: string[];
}

interface TurnstileOptions {
  /** Widget `data-action` value this surface expects. */
  expectedAction: string;
  /** Allowed frontend hostnames (e.g. `muaz.app`). Empty disables the check. */
  expectedHostnames: string[];
}

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
  options: TurnstileOptions,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!secret) {
    if (!isProduction()) return { success: true, skipped: true };
    return { success: false, errorCodes: ['missing-input-secret'] };
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { success: false, errorCodes: ['invalid-input-response'] };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  let data: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body,
    });
    if (!res.ok) return { success: false, errorCodes: [`siteverify-${res.status}`] };
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    return { success: false, errorCodes: ['internal-error'] };
  }

  if (!data.success) {
    return { success: false, errorCodes: data['error-codes'] };
  }
  if (data.action !== options.expectedAction) {
    return { success: false, errorCodes: ['action-mismatch'] };
  }
  if (
    options.expectedHostnames.length > 0 &&
    !options.expectedHostnames.includes(data.hostname ?? '')
  ) {
    return { success: false, errorCodes: ['hostname-mismatch'] };
  }

  return { success: true };
}
