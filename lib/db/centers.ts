import type { AppEnv } from './client';
import type {
  CenterStatus,
  OpeningHours,
  RecyclableCategory,
  RecyclingCenter,
  SearchParams,
  VerificationStatus,
} from '@/lib/types';
import { getDistanceKm, isOpenNow } from '@/lib/utils/centers';
import { getVoteCounts } from './votes';

interface CenterRow {
  id: string;
  slug: string;
  name: string;
  address: string;
  state: string;
  area: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  website_url: string | null;
  google_maps_url: string | null;
  accepted_items: string;
  tags: string;
  opening_hours: string;
  status: string;
  verification_status: string;
  upvote_count: number;
  downvote_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToCenter(row: CenterRow): RecyclingCenter {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    state: row.state,
    area: row.area,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.website_url ? { website_url: row.website_url } : {}),
    ...(row.google_maps_url ? { google_maps_url: row.google_maps_url } : {}),
    accepted_items: parseJson<RecyclableCategory[]>(row.accepted_items, []),
    tags: parseJson<string[]>(row.tags, []),
    opening_hours: parseJson<OpeningHours>(row.opening_hours, {}),
    status: row.status as CenterStatus,
    verification_status: row.verification_status as VerificationStatus,
    upvote_count: row.upvote_count,
    downvote_count: row.downvote_count,
    ...(row.notes ? { notes: row.notes } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(row.last_verified_at ? { last_verified_at: row.last_verified_at } : {}),
  };
}

/**
 * Search centers in D1. Text/state/verified filters run in SQL; item matching,
 * open-now, distance, and sorting run in JS so behaviour stays identical to the
 * previous in-memory implementation. Fine at this dataset size (~250 rows).
 */
export async function searchCenters(env: AppEnv, params: SearchParams): Promise<RecyclingCenter[]> {
  const where: string[] = [];
  const binds: string[] = [];

  if (params.q) {
    const q = `%${params.q.trim().toLowerCase()}%`;
    where.push(`(
      LOWER(name) LIKE ?
      OR LOWER(address) LIKE ?
      OR LOWER(state) LIKE ?
      OR LOWER(area) LIKE ?
      OR EXISTS (SELECT 1 FROM json_each(centers.tags) WHERE LOWER(json_each.value) LIKE ?)
      OR EXISTS (SELECT 1 FROM json_each(centers.accepted_items) WHERE LOWER(json_each.value) LIKE ?)
    )`);
    binds.push(q, q, q, q, q, q);
  }

  if (params.state && params.state !== 'all') {
    where.push('LOWER(state) = ?');
    binds.push(params.state.toLowerCase());
  }

  if (params.verified_only) {
    where.push("verification_status = 'VERIFIED'");
  }

  // Vote counts come from the votes table, joined so sorting by popularity works
  // without relying on the stale denormalised columns.
  const sql = `SELECT centers.*,
      COALESCE(v.up, 0) AS upvote_count,
      COALESCE(v.down, 0) AS downvote_count
    FROM centers
    LEFT JOIN (
      SELECT center_slug,
        SUM(CASE WHEN type = 'UP' THEN 1 ELSE 0 END) AS up,
        SUM(CASE WHEN type = 'DOWN' THEN 1 ELSE 0 END) AS down
      FROM votes GROUP BY center_slug
    ) v ON v.center_slug = centers.slug${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all<CenterRow>();

  let centers = (results ?? []).map(rowToCenter);

  // Items filter (AND semantics, case-insensitive exact match)
  if (params.items && params.items.length > 0) {
    const wanted = params.items.map((i) => i.toLowerCase());
    centers = centers.filter((c) => {
      const items = c.accepted_items.map((i) => i.toLowerCase());
      return wanted.every((item) => items.includes(item));
    });
  }

  // Open now
  if (params.open_now) {
    centers = centers.filter((c) => isOpenNow(c));
  }

  // Distance
  if (params.lat != null && params.lng != null) {
    const { lat, lng } = params;
    centers = centers.map((c) => ({
      ...c,
      distance_km: getDistanceKm(lat, lng, c.latitude, c.longitude),
    }));
  }

  switch (params.sort) {
    case 'nearest':
      if (params.lat != null) {
        centers.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
      }
      break;
    case 'most_upvoted':
      centers.sort((a, b) => b.upvote_count - a.upvote_count);
      break;
    case 'recently_updated':
    default:
      centers.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      break;
  }

  return centers;
}

export async function getCenterBySlug(env: AppEnv, slug: string): Promise<RecyclingCenter | null> {
  const row = await env.DB.prepare('SELECT * FROM centers WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<CenterRow>();
  if (!row) return null;

  const counts = await getVoteCounts(env, slug);
  return { ...rowToCenter(row), ...counts };
}
