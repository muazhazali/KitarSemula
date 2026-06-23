import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/utils/centers';
import { z } from 'zod';

const reportSchema = z.object({
  report_type: z.enum([
    'CLOSED_PERMANENTLY',
    'WRONG_LOCATION',
    'WRONG_HOURS',
    'WRONG_ITEMS',
    'DUPLICATE',
    'SPAM',
    'OTHER',
  ]),
  description: z.string().max(500).optional(),
  submitter_email: z.string().email('Please enter a valid email address'),
});

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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // In a real app, persist to D1. Here we just acknowledge receipt.
  return NextResponse.json(
    { message: 'Report submitted. Our team will review it shortly.' },
    { status: 201 },
  );
}
