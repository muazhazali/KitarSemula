# Deploy KitarSemula.app to Cloudflare (Workers + D1)

Goal: run the Next.js 16 app on **Cloudflare Workers** (static assets + SSR via an adapter) with **D1** for all mutable data (centers, votes, comments, reports) and **Turnstile** for abuse protection. Local `next dev` keeps working; `pnpm preview` runs the real workerd build.

## Decisions to make first

1. **Adapter: `vinext` vs `@opennextjs/cloudflare`.**
   Cloudflare now recommends **vinext** for *new* Next.js apps and treats OpenNext as the maintenance path. vinext reimplements the Next 16 API on Vite (~94% coverage, experimental). OpenNext adapts `next build` output and is battle-tested.
   **Recommendation:** run `npx vinext check`, and if it reports few/no gaps adopt vinext; otherwise use OpenNext. Either way the D1/data-layer work below is identical.
2. **Do centers live in D1, or stay a build-time snapshot?**
   Putting them in D1 is needed for a real directory (edits, approvals, no rebuild to update). That means `generateStaticParams` can no longer read them synchronously — see Phase 3.
3. **Keep `images.unoptimized: true`?** Keep it for now; enabling Cloudflare Images is a separate, optional step.

## Phase 1 — Cloudflare scaffolding

- Install: `pnpm add -D @opennextjs/cloudflare wrangler` (or `pnpm add -D vinext @vinext/cloudflare wrangler`).
- Add `wrangler.jsonc`: `main: ".open-next/worker.js"`, `compatibility_date` = today, `compatibility_flags: ["nodejs_compat"]`, `assets.directory: ".open-next/assets"` + `binding: "ASSETS"`, `observability.enabled: true`, and the D1 binding:

  ```jsonc
  "d1_databases": [{ "binding": "DB", "database_name": "kitarsemula-db", "database_id": "<id>" }]
  ```

- `next.config.mjs`: add `initOpenNextCloudflareForDev()` (OpenNext) so `getCloudflareContext()` works in `next dev`.
- `package.json` scripts:
  - `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`
  - `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`
  - `"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"`
- **Remove `@vercel/analytics`** (`app/layout.tsx:43`) — it won't work on Workers; replace with Cloudflare Web Analytics.

## Phase 2 — D1 schema + data layer

Create `migrations/0001_init.sql`:

- `centers` — all `RecyclingCenter` fields; `accepted_items`, `tags`, `opening_hours` stored as JSON `TEXT`; index on `state`, `updated_at`, `slug UNIQUE`.
- `votes` — `(center_id, voter_key, type, created_at, UNIQUE(center_id, voter_key))`. This also fixes the current gap where dedup is client-only; keep `upvote_count`/`downvote_count` on `centers` or compute from the table.
- `comments` — `(id, center_id, comment_text, submitter_email, status, created_at)`.
- `reports` — persists now instead of the current no-op.
- (Optional later) `submissions`, `photos` for the three stub flows.

**Critical structural change:** `lib/utils/centers.ts` is imported by client components (`center-detail-client.tsx:31`) *and* imports `SEED_CENTERS`. D1 access is server-only, so:

- Keep `isOpenNow`, `getTodayHours`, `getDistanceKm`, `formatDistance`, `getMarkerColor`, `getStatusLabel` in `lib/utils/centers.ts` (pure, client-safe).
- Move `searchCenters`/`getCenterBySlug` to new server-only `lib/db/*` (D1 prepared statements), plus `lib/db/client.ts` using `getCloudflareContext()` (and the `async: true` variant for prerendered routes).

`lib/seed-data.ts` stops being the runtime source; it becomes the seed input only.

## Phase 3 — Rewire routes and pages

Call sites that become `await`/D1-backed:

- `app/api/centers/route.ts` — `searchCenters` → SQL (`LIKE` for `q`, filters, sort, `LIMIT/OFFSET`); `distance_km` computed after fetch.
- `app/api/centers/[slug]/route.ts`, `vote/route.ts`, `comments/route.ts`, `report/route.ts` — D1 reads/writes; keep the zod schemas, `await params`, and status codes.
- `app/center/[slug]/page.tsx` — `generateStaticParams` must no longer read D1 synchronously at build. Recommended: keep a generated **slug-only** list for `generateStaticParams`, and fetch the full center from D1 at request time (dynamic/ISR). Keep `generateMetadata` and JSON-LD, both now async. Alternative: use remote D1 bindings during build to prerender all 246 pages, accepting that center edits need a redeploy.

## Phase 4 — Seed + local dev

- Add `scripts/seed-d1.ts` (or SQL emitted from the CSV) that upserts the 246 rows; run local then remote:

  ```
  wrangler d1 migrations apply kitarsemula-db --local
  wrangler d1 migrations apply kitarsemula-db --remote
  ```

- `pnpm dev` for fast iteration; `pnpm preview` to catch workerd-only breakage.
- Note: `recycling_centres_malaysia_v2_enriched.csv` is untracked — either commit it or keep `lib/seed-data.ts` as the seed source so CI can seed.

## Phase 5 — Abuse protection

Wire the three existing Turnstile placeholders (`comments-section.tsx:124`, `report-dialog.tsx:129`, and the stubs) to a real widget; add server-side `siteverify` in a shared `lib/turnstile.ts` reading `env.TURNSTILE_SECRET_KEY`, with the site key via `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Store secrets with `wrangler secret put`.

## Phase 6 — Deploy + CI

- `wrangler login`, `wrangler d1 create kitarsemula-db`, paste `database_id`.
- `pnpm deploy`.
- GitHub Actions workflow using `cloudflare/wrangler-action` (or `pnpm deploy`) with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, applying remote migrations before deploy.

## Gotchas

- `next.config.mjs` sets `ignoreBuildErrors: true` — keep running `pnpm exec tsc --noEmit`; the adapter won't catch type errors either.
- Comments are still created `PENDING` and `GET` returns only `APPROVED`, so nothing user-submitted shows up without an approval path. D1 makes a simple admin approval query feasible; decide this explicitly.
- `crypto.randomUUID()` is fine on Workers.
- Confirm Next **16.2.9** ↔ chosen adapter version compatibility before committing to it (OpenNext tracks newer 16.x releases closely).
- OpenNext's Windows dev support has historically been partial — verify `pnpm preview` locally early.

## Suggested execution order

1. Adapter spike on a branch: get the current app (still in-memory) building and previewing on Workers.
2. Add D1 + migrations.
3. Split pure utils from server-only `lib/db`.
4. Rewire routes/pages.
5. Seed.
6. Turnstile.
7. CI deploy.
