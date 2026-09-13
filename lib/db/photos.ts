import type { AppEnv } from './client';
import type { CenterPhoto } from '@/lib/types';
import { MAX_PHOTOS_PER_CENTER } from '@/lib/types';

interface PhotoRow {
  id: string;
  center_slug: string;
  r2_key: string;
  content_type: string;
  size: number;
  slot: number;
  created_at: string;
}

/**
 * Public URL for a photo. With an R2 custom domain configured we link straight
 * at the object; otherwise we fall back to the Worker proxy route, which is
 * keyed by the photo id.
 */
export function resolvePhotoUrl(env: AppEnv, r2Key: string, id: string): string {
  const base = env.PHOTO_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}/${r2Key}` : `/api/photos/${id}`;
}

function toCenterPhoto(env: AppEnv, row: PhotoRow): CenterPhoto {
  return {
    id: row.id,
    center_slug: row.center_slug,
    url: resolvePhotoUrl(env, row.r2_key, row.id),
    content_type: row.content_type,
    size: row.size,
    slot: row.slot,
    created_at: row.created_at,
  };
}

export async function listPhotos(env: AppEnv, slug: string): Promise<CenterPhoto[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM photos WHERE center_slug = ? ORDER BY slot ASC',
  )
    .bind(slug)
    .all<PhotoRow>();
  return (results ?? []).map((row) => toCenterPhoto(env, row));
}

/**
 * Inserts a photo, assigning the lowest free slot. Returns null when the center
 * already has MAX_PHOTOS_PER_CENTER photos. Slot assignment and the cap check
 * happen inside the single INSERT so concurrent uploads cannot exceed the cap.
 */
export async function insertPhoto(
  env: AppEnv,
  slug: string,
  r2Key: string,
  contentType: string,
  size: number,
): Promise<CenterPhoto | null> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO photos (id, center_slug, r2_key, content_type, size, slot, created_at)
     SELECT ?, ?, ?, ?, ?, (SELECT COUNT(*) FROM photos WHERE center_slug = ?), ?
     WHERE (SELECT COUNT(*) FROM photos WHERE center_slug = ?) < ?`,
  )
    .bind(id, slug, r2Key, contentType, size, slug, createdAt, slug, MAX_PHOTOS_PER_CENTER)
    .run();

  if (!result.meta.changes) return null;

  const row = await env.DB.prepare('SELECT * FROM photos WHERE id = ? LIMIT 1')
    .bind(id)
    .first<PhotoRow>();
  return row ? toCenterPhoto(env, row) : null;
}

export async function getPhoto(env: AppEnv, id: string): Promise<{ r2_key: string } | null> {
  const row = await env.DB.prepare('SELECT r2_key FROM photos WHERE id = ? LIMIT 1')
    .bind(id)
    .first<{ r2_key: string }>();
  return row ?? null;
}
