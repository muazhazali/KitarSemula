import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/utils/centers';
import { z } from 'zod';

const voteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

// In-memory vote store (resets on server restart — swap for D1 on Cloudflare)
const voteStore = new Map<string, { up: number; down: number }>();

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

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid vote type' }, { status: 422 });
  }

  const current = voteStore.get(slug) ?? {
    up: center.upvote_count,
    down: center.downvote_count,
  };

  if (parsed.data.type === 'UP') {
    voteStore.set(slug, { ...current, up: current.up + 1 });
  } else {
    voteStore.set(slug, { ...current, down: current.down + 1 });
  }

  const updated = voteStore.get(slug)!;
  return NextResponse.json({ upvote_count: updated.up, downvote_count: updated.down });
}
