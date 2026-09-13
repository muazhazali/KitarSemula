# REQUIREMENTS.md

Requirements derived from the current implementation (behavior as coded) plus the gaps the Cloudflare/Workers + D1 move must close. These describe what the system does and must keep doing, not aspirational features.

## Functional requirements

### Directory / search

Sources: `app/api/centers/route.ts`, `lib/utils/centers.ts`

- Text search across name, address, state, area, tags, and accepted items.
- Filter by state, accepted items (AND semantics), open-now, verified-only, and has-photos.
- Sort by nearest / most-upvoted / recently-updated (default).
- Paginate via `page` + `limit`; respond with `{ centers, total, page, limit }`.

### Map

Source: `components/map/recycling-map.tsx`

- Client-only Leaflet map with markers colored by status: green open / red closed / orange unverified / grey.
- Map legend.
- Geolocation button sets user location and switches sort to nearest.
- Marker click selects a center; selection pans the map and opens its popup.

### Center detail

Source: `app/center/[slug]/page.tsx`

- Per-center metadata and JSON-LD `LocalBusiness`.
- Display address, today's hours, full opening-hours table, accepted items, tags, notes, photos, and status/verification badges.
- `generateStaticParams` over all centers (246 currently).

### Community contributions

- Vote up/down with live counts (`app/api/centers/[slug]/vote/route.ts`). Client-side only one vote per page load; not yet server-side deduped.
- **Photo upload**, up to **3 per center** (`app/api/centers/[slug]/photos/route.ts`). JPEG/PNG/WebP, ≤5 MB, validated by magic bytes. Bytes in R2 (`PHOTOS` binding), metadata in D1 (`photos`). Deleting photos is intentionally not exposed publicly.
- Comments, issue reports, add-center, suggest-edit are intentionally **out of scope** and removed. Do not reintroduce without a product decision.

## Non-functional requirements

- **Persistence / durability** — must move the vote store off its module-level `Map` (resets on restart). This is the core driver for D1.
- **Performance** — search is O(n) over 246 records per request with no cache; D1 + indexes + edge delivery should hold or improve TTFB. `distance_km` is computed per request when lat/lng are provided.
- **Scalability** — reads dominate; write volume is low (votes, photos). D1 read replication covers it; R2 has effectively unbounded capacity.
- **Security** — zod-like validation plus magic-byte sniffing on photo upload; **no Turnstile, rate limiting, auth, or bot protection currently exists**; vote dedup is client-only (`vote-buttons.tsx` tracks local `voted` state, no server-side voter identity).
- **Media** — max 3 photos per center, ≤5 MB each, JPEG/PNG/WebP only; bytes in R2, metadata in D1; images served unoptimized.
- **Correctness gates** — `typescript.ignoreBuildErrors: true`, no test suite; verification is `pnpm lint` + `pnpm exec tsc --noEmit`. The adapter build will not catch type errors either.
- **SEO / shareability** — metadata templates, per-center OpenGraph, JSON-LD, static generation.
- **Accessibility** — ARIA labels, `aria-pressed` / `aria-expanded`, semantic landmarks throughout.
- **Portability / toolchain** — Node 20.18+, pnpm 11+ (lockfile v9), Windows dev; Leaflet must never render during SSR; `@vercel/analytics` must be replaced on Workers.
- **Cost / ops** — target Cloudflare free tier; secrets via `wrangler secret`; migrations + seed must run in CI before deploy.
- **Data quality** — seed is OSM/CSV-derived; all records currently `UNVERIFIED`; hours use the en-dash `–` contract that `isOpenNow` depends on.

## Requirement gaps exposed by the deploy

- No server-side vote dedup; votes are anonymous and unauthenticated (a single client can vote once per page load, and the `Map` resets on restart).
- No rate limiting or bot protection on the vote **or photo upload** endpoints. Public uploads can fill the R2 bucket; this is the highest-risk gap.
- `centers` are still read from `lib/seed-data.ts`, so photo uploads reference seed slugs while the D1 `centers` table is not yet the runtime source of truth.
- No automated tests.
