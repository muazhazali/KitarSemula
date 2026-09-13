# Deploy KitarSemula.app to Cloudflare (Workers + D1 + R2)

Goal: run the Next.js 16 app on **Cloudflare Workers** (static assets + SSR via an adapter) with **D1** for all mutable data (centers, votes, photos metadata) and **R2** for photo bytes. Local `next dev` keeps working; `pnpm preview` runs the real workerd build.

> Community scope is **votes + photo upload only**. Comments, reports, add-center, and suggest-edit were removed by product decision — do not reintroduce them.

## Decisions to make first

1. **Adapter: `vinext` vs `@opennextjs/cloudflare`.**
   Cloudflare now recommends **vinext** for _new_ Next.js apps and treats OpenNext as the maintenance path. vinext reimplements the Next 16 API on Vite (~94% coverage, experimental). OpenNext adapts `next build` output and is battle-tested.
   **Recommendation:** run `npx vinext check`, and if it reports few/no gaps adopt vinext; otherwise use OpenNext. Either way the D1/data-layer work below is identical.
   **Status:** OpenNext (`@opennextjs/cloudflare`) is already installed and `wrangler.jsonc` is scaffolded against it.
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
- `votes` — `(center_slug, voter_key, type, created_at, PK(center_slug, voter_key))`. This also fixes the current gap where dedup is client-only; keep `upvote_count`/`downvote_count` on `centers` or compute from the table.
- `photos` — see Phase 7 (implemented).

**Critical structural change:** `lib/utils/centers.ts` is imported by client components (`center-detail-client.tsx:31`) _and_ imports `SEED_CENTERS`. D1 access is server-only, so:

- Keep `isOpenNow`, `getTodayHours`, `getDistanceKm`, `formatDistance`, `getMarkerColor`, `getStatusLabel` in `lib/utils/centers.ts` (pure, client-safe).
- Move `searchCenters`/`getCenterBySlug` to new server-only `lib/db/*` (D1 prepared statements), plus `lib/db/client.ts` using `getCloudflareContext()` (and the `async: true` variant for prerendered routes).

`lib/seed-data.ts` stops being the runtime source; it becomes the seed input only.

## Phase 3 — Rewire routes and pages

Call sites that become `await`/D1-backed:

- `app/api/centers/route.ts` — `searchCenters` → SQL (`LIKE` for `q`, filters, sort, `LIMIT/OFFSET`); `distance_km` computed after fetch.
- `app/api/centers/[slug]/route.ts`, `vote/route.ts` — D1 reads/writes; keep the zod schemas, `await params`, and status codes.
- `app/center/[slug]/page.tsx` — `generateStaticParams` must no longer read D1 synchronously at build. Recommended: keep a generated **slug-only** list for `generateStaticParams`, and fetch the full center from D1 at request time (dynamic/ISR). Keep `generateMetadata` and JSON-LD, both now async. Alternative: use remote D1 bindings during build to prerender all 246 pages, accepting that center edits need a redeploy.

## Phase 4 — Seed + local dev

- Add `scripts/seed-d1.ts` (or SQL emitted from the CSV) that upserts the 246 rows; run local then remote:

  ```
  wrangler d1 migrations apply kitarsemula-db --local
  wrangler d1 migrations apply kitarsemula-db --remote
  ```

- `pnpm dev` for fast iteration; `pnpm preview` to catch workerd-only breakage.
- Note: `recycling_centres_malaysia_v2_enriched.csv` is untracked — either commit it or keep `lib/seed-data.ts` as the seed source so CI can seed.
- R2 needs a real binding; `next dev` without `initOpenNextCloudflareForDev()` will make `getAppEnv()` return null and photo routes answer 503.

## Phase 5 — Abuse protection

**Implemented.**

Turnstile (`lib/turnstile.ts` + `components/centers/turnstile-widget.tsx`):

- The photo upload form renders the widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; the token is posted as `cf-turnstile-response` alongside the file.
- The server calls Siteverify (`verifyTurnstile`) and returns 403 on failure. Tokens are single-use and expire after 300s, so the widget is re-rendered after each upload.
- **Fails open when unconfigured**: if `TURNSTILE_SECRET_KEY` is unset, verification is skipped so local dev and unconfigured deploys stay usable. This means Turnstile is only real protection once both keys are set.
- Secrets: `wrangler secret put TURNSTILE_SECRET_KEY`. The site key is public and is read from `NEXT_PUBLIC_TURNSTILE_SITE_KEY` **at build time** (Next inlines `NEXT_PUBLIC_*`), so set it in the build environment (CI secret/var or `.env.local` local), not as a Worker runtime var.

Rate limiting (`lib/rate-limit.ts`, bindings in `wrangler.jsonc`):

- `PHOTO_RATE_LIMITER` — 5 uploads / 60s per IP; 429 + `retry-after: 60` when exceeded.
- `VOTE_RATE_LIMITER` — 30 votes / 60s per IP.
- Keyed on `cf-connecting-ip`; also **fails open** when the binding is absent (local dev).
- Note: the Cloudflare rate-limit binding is per-colo, so limits are approximate globally.

Still open: moving votes to the D1 `votes` table for real server-side dedup (Phase 2). Rate limiting caps abuse but does not make votes one-per-user.

## Phase 6 — Deploy + CI

**CI implemented** in `.github/workflows/deploy.yml` (push to `main` or manual dispatch):

1. install (frozen lockfile) → `pnpm cf-typegen` → lint → typecheck
2. `wrangler d1 migrations apply --remote`
3. `pnpm deploy`

Required GitHub repo config:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variable (optional): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — read at build time

One-time Cloudflare setup (interactive; run locally):

```
wrangler login
wrangler d1 create kitarsemula-db          # paste the id into wrangler.jsonc
wrangler r2 bucket create kitarsemula-photos
wrangler secret put TURNSTILE_SECRET_KEY
```

**Windows caveat:** `opennextjs-cloudflare build` needs symlink permission and fails on native Windows with `EPERM: operation not permitted, symlink` unless Developer Mode is enabled. WSL is not installed on this machine, so CI (Linux) is the supported build path. The `next build` portion succeeds on Windows; only the bundling step fails.

Also required at the repo root: `open-next.config.ts` (OpenNext refuses to build without it).

## Phase 7 — Photos (R2 + D1)

**Implemented.** Design: bytes in R2, metadata in D1, hard cap of **3 photos per center**.

Data model (`migrations/0001_init.sql`):

```sql
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  center_slug TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 3),
  created_at TEXT NOT NULL,
  UNIQUE (center_slug, slot)
);
```

- `UNIQUE (center_slug, slot)` + the `slot` CHECK is what enforces the 3-photo cap at the database level.
- The cap is enforced atomically in one statement (`lib/db/photos.ts#insertPhoto`): the INSERT...SELECT only fires when `COUNT(*) < 3`, and slot is the current count. Concurrent uploads cannot exceed the cap; the loser gets 409.
- Slot 0 is intended as the center thumbnail.

Storage/serving:

- Binding `PHOTOS` (R2 bucket `kitarsemula-photos`) in `wrangler.jsonc`.
- `PHOTO_PUBLIC_BASE_URL` (optional env var): when set to an R2 custom domain (e.g. `https://photos.kitarsemula.app`), `resolvePhotoUrl` links straight at the object. Otherwise it falls back to `/api/photos/<id>`, a Worker route that streams the private object with a 1-year immutable cache header.

API:

- `app/api/centers/[slug]/photos/route.ts`
  - `GET` → `{ photos, max }` for the center.
  - `POST` → multipart `file`. Validates size (≤5 MB) and **sniffs magic bytes** for JPEG/PNG/WebP rather than trusting `file.type`. Returns 201, or 409 when the cap is hit (and deletes the just-uploaded R2 object in that case).
- `app/api/photos/[id]/route.ts` — `GET` streams the object (proxy mode only).

UI: `components/centers/photos-section.tsx`, rendered by `center-detail-client.tsx`. Shows `n/3`, an upload button disabled at the limit, and uses TanStack Query to refresh after upload.

Deliberately **not** included: public delete. Unauthenticated deletion would let anyone wipe a center's photos; add it behind auth if needed. `lib/db/photos.ts#deletePhoto` was removed for the same reason.

`lib/db/client.ts#getAppEnv()` returns `null` when bindings are unavailable (e.g. `next dev` without the adapter init), so routes answer 503 instead of crashing.

## Gotchas

- `next.config.mjs` sets `ignoreBuildErrors: true` — keep running `pnpm exec tsc --noEmit`; the adapter won't catch type errors either.
- `worker-configuration.d.ts` is generated by `pnpm cf-typegen` and gitignored. Rerun it after changing bindings, or `D1Database`/`R2Bucket` will be undefined in typecheck.
- Adding the Workers ambient types (`worker-configuration.d.ts`) makes `Response.json()` return `unknown`, so `res.json()` call sites need explicit casts. Existing ones were fixed; new fetches must do the same.
- `crypto.randomUUID()` is fine on Workers.
- Confirm Next **16.2.9** ↔ chosen adapter version compatibility before committing to it (OpenNext tracks newer 16.x releases closely).
- OpenNext's Windows dev support has historically been partial — verify `pnpm preview` locally early.

## Suggested execution order

1. Adapter spike on a branch: get the current app (still in-memory) building and previewing on Workers.
2. Add D1 + migrations.
3. Split pure utils from server-only `lib/db`.
4. Rewire routes/pages.
5. Seed.
6. Photos (Phase 7) — done.
7. Turnstile + rate limiting (Phase 5) — done.
8. CI deploy.
