import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/db/centers';
import { getAppEnv } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
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
  return NextResponse.json(center);
}
