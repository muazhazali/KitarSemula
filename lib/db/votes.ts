import type { AppEnv } from './client';

export interface VoteCounts {
  upvote_count: number;
  downvote_count: number;
}

/**
 * Records a vote for a center and returns the updated counts.
 *
 * One vote per `voterKey` per center, enforced by the `votes` primary key.
 * A repeat vote from the same key updates the existing row rather than
 * incrementing again. Counts are derived by aggregating the `votes` table, so
 * they cannot drift from the underlying records.
 */
export async function recordVote(
  env: AppEnv,
  slug: string,
  voterKey: string,
  type: 'UP' | 'DOWN',
): Promise<VoteCounts> {
  await env.DB.prepare(
    `INSERT INTO votes (center_slug, voter_key, type, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (center_slug, voter_key) DO UPDATE SET type = excluded.type, created_at = excluded.created_at`,
  )
    .bind(slug, voterKey, type, new Date().toISOString())
    .run();

  return getVoteCounts(env, slug);
}

export async function getVoteCounts(env: AppEnv, slug: string): Promise<VoteCounts> {
  const row = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'UP' THEN 1 ELSE 0 END), 0) AS up,
       COALESCE(SUM(CASE WHEN type = 'DOWN' THEN 1 ELSE 0 END), 0) AS down
     FROM votes WHERE center_slug = ?`,
  )
    .bind(slug)
    .first<{ up: number; down: number }>();

  return { upvote_count: row?.up ?? 0, downvote_count: row?.down ?? 0 };
}
