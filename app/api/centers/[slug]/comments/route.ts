import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/utils/centers';
import { z } from 'zod';
import type { Comment } from '@/lib/types';

const commentSchema = z.object({
  comment_text: z.string().min(5, 'Comment must be at least 5 characters').max(1000),
  submitter_email: z.string().email('Please enter a valid email address'),
});

// In-memory comment store keyed by slug
const commentStore = new Map<string, Comment[]>();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const center = getCenterBySlug(slug);
  if (!center) {
    return NextResponse.json({ error: 'Center not found' }, { status: 404 });
  }
  const comments = (commentStore.get(slug) ?? []).filter((c) => c.status === 'APPROVED');
  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const center = getCenterBySlug(slug);
  if (!center) {
    return NextResponse.json({ error: 'Center not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const comment: Comment = {
    id: crypto.randomUUID(),
    center_id: center.id,
    comment_text: parsed.data.comment_text,
    submitter_email: parsed.data.submitter_email,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  const existing = commentStore.get(slug) ?? [];
  commentStore.set(slug, [...existing, comment]);

  return NextResponse.json(
    { message: 'Comment submitted for review. Thank you!', id: comment.id },
    { status: 201 },
  );
}
