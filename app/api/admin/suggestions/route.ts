import { NextRequest, NextResponse } from 'next/server';
import { adminUnauthorized, isAdminRequest } from '@/lib/admin-auth';
import { getAppEnv } from '@/lib/db/client';
import { listSuggestions } from '@/lib/db/suggestions';
import type { SuggestionStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: (SuggestionStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

export async function GET(request: NextRequest) {
  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }
  if (!(await isAdminRequest(request, env))) return adminUnauthorized();

  const requested = request.nextUrl.searchParams.get('status');
  const status = VALID_STATUSES.includes(requested as SuggestionStatus | 'ALL')
    ? (requested as SuggestionStatus | 'ALL')
    : 'PENDING';

  const suggestions = await listSuggestions(env, status);
  return NextResponse.json({ suggestions });
}
