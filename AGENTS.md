# AGENTS.md

KitarSemula.app — Malaysia recycling center directory. Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui, packaged with pnpm.

## Commands

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint (`eslint .`, flat config in `eslint.config.mjs`, based on `eslint-config-next`).
- `pnpm lint:fix` — ESLint with `--fix`.
- `pnpm format` — Prettier (`prettier . --write`).
- `pnpm format:check` — Prettier check-only (CI-style).
- No test suite exists. Do not invent test commands.

## Critical gotchas

- **Build ignores TypeScript errors.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` passing does NOT mean the code typechecks. There is no `typecheck` script — run `pnpm exec tsc --noEmit` manually to verify types.
- **Data is in-memory, not a database.** All centers come from `lib/seed-data.ts` (`SEED_CENTERS`). The vote API (`app/api/centers/[slug]/vote/route.ts`) uses a module-level `Map` that resets on server restart. Comments/reports are likely similar. Do not assume persistence; do not wire a real DB without checking these routes.
- `next.config.mjs` disables image optimization (`images.unoptimized: true`) — likely for static/edge export. Don't add `next/image` features that require the optimizer.
- **Dependency overrides live in `pnpm-workspace.yaml`, not `package.json`.** pnpm 11+ ignores the `pnpm.overrides` field in `package.json`. Overrides (`hono` 4.12.25 pin, `postcss` ^8.5.15 security pin) are in `pnpm-workspace.yaml` — preserve and edit them there.
- **Pre-commit hook (husky + lint-staged)** runs Prettier + `eslint --fix` on staged files. The `prepare` script installs hooks on `pnpm install` once the repo is a git repo (husky no-ops if `.git` is absent).

## Structure

- `app/` — App Router pages and route handlers.
  - `app/api/centers/route.ts` — search API (`GET`, reads `SearchParams` from query string, filters `SEED_CENTERS` via `lib/utils/centers.ts#searchCenters`).
  - `app/api/centers/[slug]/{vote,comments,report}/` — per-center mutation endpoints.
  - `app/center/[slug]/` — center detail page.
- `lib/` — domain logic.
  - `lib/types.ts` — all shared types AND runtime constants (`RECYCLABLE_CATEGORIES`, `MALAYSIA_STATES`, `REPORT_TYPES`). Import constants from here, not hardcoded strings.
  - `lib/seed-data.ts` — the single source of center records.
  - `lib/utils/centers.ts` — search/filter/distance (haversine)/open-now logic. Reuse these helpers; don't reimplement.
- `components/` — UI, grouped by feature (`home/`, `centers/`, `map/`, `search/`, `providers/`, `ui/`). `components/ui/` is shadcn-generated.

## Conventions

- Path alias `@/*` → repo root (see `tsconfig.json` paths and `components.json` aliases).
- shadcn/ui config: `style: base-nova`, `iconLibrary: lucide`, base color `neutral`, CSS variables in `app/globals.css`. Add components via `pnpm dlx shadcn@latest add <name>`.
- Tailwind v4 via `@tailwindcss/postcss` — there is NO `tailwind.config.js`; theme/CSS variables live in `app/globals.css`.
- Opening-hours strings use the en-dash `–` (U+2013) as the separator, e.g. `8:00 AM – 12:00 PM`. The `isOpenNow` parser splits on `–`, not `-`. Preserve this when editing hours.
- Maps use `leaflet` / `react-leaflet` (client-only). Any map component must be client-side and dynamically imported with `ssr: false`; do not render Leaflet during SSR.
- `@vercel/analytics` renders only in production (`layout.tsx`).

## Verification before finishing

After edits, run: `pnpm lint` and `pnpm exec tsc --noEmit`. Do not rely on `pnpm build` alone — it won't fail on type errors.
