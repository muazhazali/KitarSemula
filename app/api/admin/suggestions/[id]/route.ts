import { NextRequest, NextResponse } from 'next/server';
import { adminUnauthorized, isAdminRequest } from '@/lib/admin-auth';
import { getAppEnv } from '@/lib/db/client';
import { approveSuggestion, rejectSuggestion } from '@/lib/db/suggestions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }
  if (!(await isAdminRequest(request, env))) return adminUnauthorized();

  const { id } = await params;

  let body: { action?: unknown; note?: unknown } | null;
  try {
    body = (await request.json()) as { action?: unknown; note?: unknown } | null;
  } catch {
    body = null;
  }

  const action = body?.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Expected action "approve" or "reject"' }, { status: 400 });
  }

  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : undefined;

  if (action === 'approve') {
    const result = await approveSuggestion(env, id, note);
    if (!result.ok) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
      }
      if (result.error === 'not_pending') {
        return NextResponse.json(
          { error: 'This suggestion has already been reviewed' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: 'A matching center already exists.',
          existingSlug: result.existingSlug,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      center: result.center,
      suggestion: result.suggestion,
    });
  }

  const result = await rejectSuggestion(env, id, note);
  if (result.notFound) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This suggestion has already been reviewed' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
