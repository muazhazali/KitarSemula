import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/db/centers';
import { getAppEnv } from '@/lib/db/client';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { recordVote } from '@/lib/db/votes';
import { z } from 'zod';

const voteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  const center = await getCenterBySlug(env, slug);
  if (!center) {
    return NextResponse.json({ error: 'Center not found' }, { status: 404 });
  }

  const limit = await checkRateLimit(env.VOTE_RATE_LIMITER, clientKey(request, 'vote'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many votes. Please slow down.' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
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

  // One vote per IP per center, enforced by the votes table primary key.
  const counts = await recordVote(env, slug, clientKey(request, 'voter'), parsed.data.type);
  return NextResponse.json(counts);
}
