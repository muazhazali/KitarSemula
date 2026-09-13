/** Runtime environment helpers. */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * The public Turnstile site key, inlined at build time. It is read on the
 * client to decide whether to render the widget; the server uses the separate
 * `TURNSTILE_SECRET_KEY` binding.
 */
export function turnstileSiteKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key && key.length > 0 ? key : undefined;
}

/** Parses a comma-separated hostname allowlist into a trimmed array. */
export function parseHostnames(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((hostname) => hostname.trim())
    .filter(Boolean);
}

/** Turnstile action for the photo-upload surface. */
export const TURNSTILE_ACTION_PHOTO_UPLOAD = 'photo_upload';
