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

- Vote up/down with live counts (`app/api/centers/[slug]/vote/route.ts`), persisted in D1. One vote per IP per center (repeat votes update rather than increment).
- **Photo upload**, **1 per center**, ≤1 MB (`app/api/centers/[slug]/photos/route.ts`). JPEG/PNG/WebP, validated by magic bytes. Bytes in R2 (`PHOTOS` binding), metadata in D1 (`photos`). Deleting photos is intentionally not exposed publicly.
- Comments, issue reports, add-center, suggest-edit are intentionally **out of scope** and removed. Do not reintroduce without a product decision.

## Non-functional requirements

- **Persistence / durability** — centers and votes persist in Cloudflare D1; photo bytes in R2. Vote counts are derived by aggregating the `votes` table, so they cannot drift.
- **Performance** — text/state/verified filters run in SQL; item matching, open-now, distance, and sorting run in JS over the filtered set (~250 rows), matching the previous in-memory semantics.
- **Scalability** — reads dominate; write volume is low (votes, photos). D1 read replication covers it; R2 has effectively unbounded capacity.
- **Security** — zod validation plus magic-byte sniffing on photo upload; rate limiting (5 uploads/min, 30 votes/min per IP) and Turnstile both **fail closed in production** when their binding/secret is missing; baseline security headers (CSP, HSTS, `nosniff`, frame denial) set in `middleware.ts`. Votes are deduped per IP per center via the `votes` primary key, but IP is a coarse identity and there is no auth.
- **Media** — max 1 photo per center, ≤1 MB, JPEG/PNG/WebP only; bytes in R2, metadata in D1; images served unoptimized with `nosniff`.- **Correctness gates** — `typescript.ignoreBuildErrors: true`, no test suite; verification is `pnpm lint` + `pnpm exec tsc --noEmit`. The adapter build will not catch type errors either.
- **SEO / shareability** — metadata templates, per-center OpenGraph, JSON-LD, static generation.
- **Accessibility** — ARIA labels, `aria-pressed` / `aria-expanded`, semantic landmarks throughout.
- **Portability / toolchain** — Node 20.18+, pnpm 11+ (lockfile v9), Windows dev; Leaflet must never render during SSR; `@vercel/analytics` must be replaced on Workers.
- **Cost / ops** — target Cloudflare free tier; secrets via `wrangler secret`; migrations + seed must run in CI before deploy.
- **Data quality** — seed is OSM/CSV-derived; all records currently `UNVERIFIED`; hours use the en-dash `–` contract that `isOpenNow` depends on.

## Requirement gaps exposed by the deploy

- Vote identity is IP-based, so users behind shared NAT cannot vote independently and a determined user can rotate IPs. No auth or accounts.
- Rate limiting is per-colo, so limits are approximate globally.
- Center records have no write path: they are seeded from the CSV, and there is no admin UI or API to add/edit centers.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is build-time; a deploy without it in the build env disables the widget and (with a secret present) uploads fail closed.
- No automated tests.
