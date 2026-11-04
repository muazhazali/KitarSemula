import type { AppEnv } from './client';
import { createCenter, findDuplicateCenter } from './centers';
import type { CreateCenterResult } from './centers';
import type {
  CenterSubmission,
  CenterSuggestion,
  RecyclableCategory,
  RecyclingCenter,
  SuggestionStatus,
} from '@/lib/types';

interface SuggestionRow {
  id: string;
  name: string;
  address: string;
  state: string;
  area: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  website_url: string | null;
  accepted_items: string;
  notes: string | null;
  status: string;
  center_slug: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function parseItems(value: string): RecyclableCategory[] {
  try {
    return JSON.parse(value) as RecyclableCategory[];
  } catch {
    return [];
  }
}

function toSuggestion(row: SuggestionRow): CenterSuggestion {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    state: row.state,
    area: row.area,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.website_url ? { website_url: row.website_url } : {}),
    accepted_items: parseItems(row.accepted_items),
    ...(row.notes ? { notes: row.notes } : {}),
    status: row.status as SuggestionStatus,
    ...(row.center_slug ? { center_slug: row.center_slug } : {}),
    ...(row.review_note ? { review_note: row.review_note } : {}),
    created_at: row.created_at,
    ...(row.reviewed_at ? { reviewed_at: row.reviewed_at } : {}),
  };
}

export type InsertSuggestionResult =
  | { ok: true; suggestion: CenterSuggestion }
  | { ok: false; duplicateCenter: { slug: string; name: string } }
  | { ok: false; duplicatePending: true };

/**
 * Queues a community submission. Existing centers are rejected immediately so
 * people are pointed at the live listing; an identical pending suggestion is
 * also rejected to keep the review queue clean.
 */
export async function insertSuggestion(
  env: AppEnv,
  input: CenterSubmission,
): Promise<InsertSuggestionResult> {
  const duplicateCenter = await findDuplicateCenter(env, input);
  if (duplicateCenter) return { ok: false, duplicateCenter };

  const duplicatePending = await env.DB.prepare(
    `SELECT id FROM center_suggestions
     WHERE status = 'PENDING' AND LOWER(name) = LOWER(?) AND LOWER(state) = LOWER(?)
     LIMIT 1`,
  )
    .bind(input.name, input.state)
    .first<{ id: string }>();
  if (duplicatePending) return { ok: false, duplicatePending: true };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO center_suggestions (
       id, name, address, state, area, latitude, longitude,
       phone, website_url, accepted_items, notes, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
  )
    .bind(
      id,
      input.name,
      input.address,
      input.state,
      input.area,
      input.latitude,
      input.longitude,
      input.phone ?? null,
      input.website_url ?? null,
      JSON.stringify(input.accepted_items),
      input.notes ?? null,
      now,
    )
    .run();

  const row = await env.DB.prepare('SELECT * FROM center_suggestions WHERE id = ? LIMIT 1')
    .bind(id)
    .first<SuggestionRow>();

  if (!row) throw new Error('Suggestion insert did not return a row');
  return { ok: true, suggestion: toSuggestion(row) };
}

export async function listSuggestions(
  env: AppEnv,
  status: SuggestionStatus | 'ALL' = 'PENDING',
): Promise<CenterSuggestion[]> {
  const sql =
    status === 'ALL'
      ? 'SELECT * FROM center_suggestions ORDER BY created_at DESC LIMIT 100'
      : 'SELECT * FROM center_suggestions WHERE status = ? ORDER BY created_at DESC LIMIT 100';
  const statement = env.DB.prepare(sql);
  const { results } = await (
    status === 'ALL' ? statement : statement.bind(status)
  ).all<SuggestionRow>();
  return (results ?? []).map(toSuggestion);
}

export type ReviewResult =
  | { ok: true; center: RecyclingCenter; suggestion: CenterSuggestion }
  | { ok: false; error: 'not_found' | 'not_pending' | 'duplicate'; existingSlug?: string };

/**
 * Approves a pending suggestion and publishes it as a VERIFIED center.
 *
 * The status update runs first as a claim on the PENDING row, so two reviewers
 * cannot approve the same suggestion twice. If publishing then fails because a
 * matching center appeared meanwhile, the suggestion is returned to PENDING.
 */
export async function approveSuggestion(
  env: AppEnv,
  id: string,
  note?: string,
): Promise<ReviewResult> {
  const now = new Date().toISOString();
  const claim = await env.DB.prepare(
    `UPDATE center_suggestions
     SET status = 'APPROVED', reviewed_at = ?, review_note = ?
     WHERE id = ? AND status = 'PENDING'`,
  )
    .bind(now, note ?? null, id)
    .run();

  const row = await env.DB.prepare('SELECT * FROM center_suggestions WHERE id = ? LIMIT 1')
    .bind(id)
    .first<SuggestionRow>();
  if (!row) return { ok: false, error: 'not_found' };
  if (!claim.meta.changes) return { ok: false, error: 'not_pending' };

  const suggestion = toSuggestion(row);

  const releaseClaim = async () => {
    await env.DB.prepare(
      `UPDATE center_suggestions SET status = 'PENDING', reviewed_at = NULL WHERE id = ?`,
    )
      .bind(id)
      .run();
  };

  let result: CreateCenterResult;
  try {
    result = await createCenter(
      env,
      {
        name: suggestion.name,
        address: suggestion.address,
        state: suggestion.state,
        area: suggestion.area,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        accepted_items: suggestion.accepted_items,
        ...(suggestion.phone ? { phone: suggestion.phone } : {}),
        ...(suggestion.website_url ? { website_url: suggestion.website_url } : {}),
        ...(suggestion.notes ? { notes: suggestion.notes } : {}),
      },
      { verificationStatus: 'VERIFIED', lastVerifiedAt: now },
    );
  } catch (error) {
    await releaseClaim();
    throw error;
  }

  if (!result.ok) {
    await releaseClaim();
    return {
      ok: false,
      error: 'duplicate',
      existingSlug: result.duplicate.slug,
    };
  }

  await env.DB.prepare('UPDATE center_suggestions SET center_slug = ? WHERE id = ?')
    .bind(result.center.slug, id)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM center_suggestions WHERE id = ? LIMIT 1')
    .bind(id)
    .first<SuggestionRow>();

  return {
    ok: true,
    center: result.center,
    suggestion: updated ? toSuggestion(updated) : suggestion,
  };
}

export async function rejectSuggestion(
  env: AppEnv,
  id: string,
  note?: string,
): Promise<{ ok: boolean; notFound: boolean }> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE center_suggestions
     SET status = 'REJECTED', reviewed_at = ?, review_note = ?
     WHERE id = ? AND status = 'PENDING'`,
  )
    .bind(now, note ?? null, id)
    .run();

  if (result.meta.changes) return { ok: true, notFound: false };

  const row = await env.DB.prepare('SELECT 1 FROM center_suggestions WHERE id = ? LIMIT 1')
    .bind(id)
    .first();
  return { ok: false, notFound: !row };
}
