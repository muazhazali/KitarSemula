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

**Implemented.** `migrations/0001_init.sql`:

- `centers` — all `RecyclingCenter` fields; `accepted_items`, `tags`, `opening_hours` stored as JSON `TEXT`; indexes on `state`, `updated_at`, `slug UNIQUE`.
- `votes` — `(center_slug, voter_key, type, created_at, PK(center_slug, voter_key))`. Vote counts are aggregated from this table rather than stored denormalised on `centers`, so they cannot drift.
- `photos` — see Phase 7.

Structural split (done):

- `lib/utils/centers.ts` keeps only pure, client-safe helpers (`isOpenNow`, `getTodayHours`, `getDistanceKm`, `formatDistance`, `getMarkerColor`, `getStatusLabel`) and no longer imports seed data. This matters because `center-card.tsx` and `recycling-map.tsx` are client components.
- `lib/db/centers.ts` owns D1 search + lookup (`rowToCenter`, `searchCenters`, `getCenterBySlug`, `getAllSlugs`).
- `lib/db/votes.ts` owns vote persistence (`recordVote`, `getVoteCounts`).

Search strategy: text/state/verified filters run in SQL (`LIKE` + `json_each` over the JSON columns); item matching, open-now, distance, and sorting run in JS over the filtered set to preserve the previous semantics. Fine at ~250 rows.

`lib/seed-data.ts` is now seed input only — no app code imports it.

## Phase 3 — Rewire routes and pages

**Implemented.**

- `app/api/centers/route.ts` — parses `SearchParams` and delegates to `lib/db/centers.ts#searchCenters`; paginates in JS after search.
- `app/api/centers/[slug]/route.ts` / `vote/route.ts` / `photos/route.ts` — D1 reads; `vote` writes to the `votes` table, keyed per IP for dedup, after rate limiting.
- `app/center/[slug]/page.tsx` — `generateStaticParams` reads the generated `lib/center-slugs.ts` (the D1 binding is not available at build time); the page is ISR (`revalidate = 300`) and fetches the full record from D1 per request. `generateMetadata` and JSON-LD are async.

## Phase 4 — Seed + local dev

**Implemented.** `scripts/seed-d1.ts` emits upsert SQL (`INSERT ... ON CONFLICT (slug) DO UPDATE`) from `lib/seed-data.ts` to `.wrangler/seed.sql`, so re-running is safe.

```
pnpm seed:local     # migrate + seed the local D1
pnpm seed:remote    # seed production D1
pnpm exec wrangler d1 migrations apply kitarsemula-db --local|--remote
```

Verified: 246 centers in both local and remote D1.

Two traps worth remembering:

- `scripts/seed-d1.ts` writes the file itself in UTF-8 **without BOM**. Redirecting its stdout with PowerShell `>` produces UTF-16, which wrangler rejects.
- Remote D1 rejects `BEGIN TRANSACTION` in an executed SQL file; do not wrap the seed in a transaction.

- R2 needs a real binding; `next dev` without `initOpenNextCloudflareForDev()` will make `getAppEnv()` return null and D1/photo routes answer 503.
- `recycling_centres_malaysia_v2_enriched.csv` is untracked; `lib/seed-data.ts` is committed and is what the seed script reads, so CI can seed without the CSV.

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
- **`wrangler deploy` silently re-runs the OpenNext build and will deploy stale/absent artifacts.** After a code change, confirm the change is actually in the bundle before trusting a deploy; if behaviour looks stale, delete both `.next` and `.open-next` and rebuild from clean.
- **Windows build requires `nodeLinker: hoisted`** in `pnpm-workspace.yaml`. OpenNext recreates pnpm's symlinks with `fs.symlinkSync`, which Windows blocks with `EPERM` without Developer Mode. pnpm 11 ignores `.npmrc`, so the setting must be in `pnpm-workspace.yaml`.
- Confirm Next **16.2.9** ↔ chosen adapter version compatibility before upgrading.
- OpenNext's Windows support is explicitly warned against upstream; the clean-build-from-scratch path above is the reliable workaround.

## Status

1. Adapter spike — done.
2. D1 + migrations — done.
3. Split pure utils from server-only `lib/db` — done.
4. Rewire routes/pages — done.
5. Seed (246 centers, local + remote) — done.
6. Photos (Phase 7) — done.
7. Turnstile + rate limiting (Phase 5) — done.
8. CI deploy workflow — written, not yet exercised.
9. Turnstile keys not yet configured in production (fails open).
