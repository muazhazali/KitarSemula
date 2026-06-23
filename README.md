# KitarSemula.app

Malaysia recycling center directory. Find recycling drop-off points near you for paper, plastic, e-waste, glass, metals, and more.

Built with Next.js 16 (App Router), React 19, Tailwind v4, and shadcn/ui.

## Prerequisites

- **Node.js** 20.18+ (recommended: latest LTS)
- **pnpm** 11+ (enable via `corepack enable pnpm`, or `npm install -g pnpm`)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server
pnpm dev
```

The app runs at **http://localhost:3000**.

## Available scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start the dev server (Turbopack) |
| `pnpm build`        | Production build                 |
| `pnpm start`        | Run the production build         |
| `pnpm lint`         | Lint with ESLint                 |
| `pnpm lint:fix`     | Lint and auto-fix                |
| `pnpm format`       | Format all files with Prettier   |
| `pnpm format:check` | Check formatting without writing |

No test suite exists yet.

## Notes for contributors

- **Type errors don't fail the build.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`. Before pushing, run `pnpm exec tsc --noEmit` to typecheck — `pnpm build` passing does not guarantee clean types.
- **Data is in-memory.** Center records come from `lib/seed-data.ts`. Votes, comments, and reports use module-level stores that reset on server restart — there is no database.
- **Pre-commit hook.** Husky + lint-staged run Prettier and `eslint --fix` on staged files. The hook activates automatically once the repo is a git repo (run `git init` if needed, then `pnpm install` to wire it up).

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router, Turbopack)
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) v4
- [shadcn/ui](https://ui.shadcn.com/) (base-nova style)
- [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) for maps
- [TanStack Query](https://tanstack.com/query) for data fetching
- [Zod](https://zod.dev/) for validation

## License

MIT
