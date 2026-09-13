import { NextRequest, NextResponse } from 'next/server';
import { searchCenters } from '@/lib/db/centers';
import { getAppEnv } from '@/lib/db/client';
import type { SearchParams } from '@/lib/types';

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
