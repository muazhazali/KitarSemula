import { NextRequest, NextResponse } from 'next/server';
import { searchCenters } from '@/lib/utils/centers';
import type { SearchParams } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const params: SearchParams = {
    q: searchParams.get('q') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    items: searchParams.getAll('items'),
    open_now: searchParams.get('open_now') === 'true',
    verified_only: searchParams.get('verified_only') === 'true',
    has_photos: searchParams.get('has_photos') === 'true',
    sort: (searchParams.get('sort') as SearchParams['sort']) ?? 'recently_updated',
    lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
    lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
    page: parseInt(searchParams.get('page') ?? '1'),
    limit: parseInt(searchParams.get('limit') ?? '50'),
  };

  const centers = searchCenters(params);

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
