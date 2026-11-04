import type { AppEnv } from './db/client';

/**
 * Admin authentication for the suggestion review API.
 *
 * There is no user account system, so review access is gated by a single
 * bearer token (`ADMIN_TOKEN` Worker secret). The token is read from the
 * binding, with a `process.env` fallback for `next dev` where `.dev.vars` may
 * not be mounted. A missing token always fails closed, including in development.
 */
function expectedToken(env: AppEnv): string | undefined {
  return env.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN;
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [aHash, bHash] = await Promise.all([digest(a), digest(b)]);
  let difference = 0;
  for (let i = 0; i < aHash.length; i += 1) difference |= aHash[i] ^ bHash[i];
  return difference === 0;
}

export async function isAdminRequest(request: Request, env: AppEnv): Promise<boolean> {
  const expected = expectedToken(env);
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;

  return constantTimeEqual(match[1].trim(), expected);
}

export function adminUnauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
