/**
 * Cloudflare Turnstile server-side verification.
 *
 * The client-side widget alone provides no protection; the token it produces
 * must be validated against the Siteverify API. Tokens are single-use and
 * expire after 300 seconds.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  success: boolean;
  errorCodes?: string[];
}

/**
 * Verifies a Turnstile token. Returns `{ success: true }` when the widget is
 * not configured at all, so local development and un-configured deploys keep
 * working instead of failing closed.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!secret) return { success: true };
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    return { success: data.success, errorCodes: data['error-codes'] };
  } catch {
    return { success: false, errorCodes: ['internal-error'] };
  }
}
