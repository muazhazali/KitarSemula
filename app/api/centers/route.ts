import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchCenters } from '@/lib/db/centers';
import { insertSuggestion } from '@/lib/db/suggestions';
import { getAppEnv } from '@/lib/db/client';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { TURNSTILE_ACTION_CENTER_SUBMIT, parseHostnames } from '@/lib/env';
import { MALAYSIA_STATES, RECYCLABLE_CATEGORIES } from '@/lib/types';
import type { RecyclableCategory, SearchParams } from '@/lib/types';

const submissionSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120, 'Name is too long'),
  address: z.string().trim().min(5, 'Address is too short').max(300, 'Address is too long'),
  area: z.string().trim().min(1, 'Area is required').max(80, 'Area is too long'),
  state: z
    .string()
    .trim()
    .refine((value) => (MALAYSIA_STATES as readonly string[]).includes(value), {
      message: 'Choose a valid state',
    }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accepted_items: z
    .array(z.string())
    .min(1, 'Select at least one accepted item')
    .max(RECYCLABLE_CATEGORIES.length)
    .refine(
      (items) => items.every((item) => (RECYCLABLE_CATEGORIES as readonly string[]).includes(item)),
      { message: 'Unknown accepted item' },
    )
    .transform((items) => Array.from(new Set(items)) as RecyclableCategory[]),
  phone: z.string().trim().max(40).optional(),
  website_url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((value) => !value || /^https?:\/\/\S+\.\S+/i.test(value), {
      message: 'Website must start with http:// or https://',
    }),
  notes: z.string().trim().max(1000).optional(),
  'cf-turnstile-response': z.string().max(2048).optional(),
});

export async function GET(request: NextRequest) {
  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);

  const params: SearchParams = {
    q: searchParams.get('q') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    items: searchParams.getAll('items'),
    open_now: searchParams.get('open_now') === 'true',
    verified_only: searchParams.get('verified_only') === 'true',
    sort: (searchParams.get('sort') as SearchParams['sort']) ?? 'recently_updated',
    lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
    lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
    page: parseInt(searchParams.get('page') ?? '1'),
    limit: parseInt(searchParams.get('limit') ?? '50'),
  };

  const centers = await searchCenters(env, params);

  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const start = (page - 1) * limit;
  const paginated = centers.slice(start, start + limit);

  return NextResponse.json({
    centers: paginated,
    total: centers.length,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  const limit = await checkRateLimit(env.SUBMIT_RATE_LIMITER, clientKey(request, 'center-submit'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait a minute and try again.' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form fields' },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const verification = await verifyTurnstile(
    data['cf-turnstile-response'],
    env.TURNSTILE_SECRET_KEY,
    {
      expectedAction: TURNSTILE_ACTION_CENTER_SUBMIT,
      expectedHostnames: parseHostnames(env.TURNSTILE_HOSTNAMES),
    },
    request.headers.get('cf-connecting-ip') ?? undefined,
  );
  if (!verification.success) {
    return NextResponse.json(
      { error: 'Human verification failed. Please refresh and try again.' },
      { status: 403 },
    );
  }

  try {
    const result = await insertSuggestion(env, {
      name: data.name,
      address: data.address,
      area: data.area,
      state: data.state,
      latitude: data.latitude,
      longitude: data.longitude,
      accepted_items: data.accepted_items,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.website_url ? { website_url: data.website_url } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });

    if (!result.ok) {
      if ('duplicateCenter' in result) {
        return NextResponse.json(
          {
            error: `${result.duplicateCenter.name} is already listed.`,
            existingSlug: result.duplicateCenter.slug,
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: 'This center is already awaiting review.' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        suggestion: { id: result.suggestion.id, status: result.suggestion.status },
        message: 'Thanks! Your suggestion is waiting for review.',
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('Center submission failed', error);
    return NextResponse.json(
      { error: 'Could not submit the center. Please try again.' },
      { status: 500 },
    );
  }
}
