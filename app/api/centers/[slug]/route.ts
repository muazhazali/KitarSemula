import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/utils/centers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const center = getCenterBySlug(slug);
  if (!center) {
    return NextResponse.json({ error: 'Center not found' }, { status: 404 });
  }
  return NextResponse.json(center);
}
