# Chupaprecios storefront

Next.js (App Router, React Server Components, TypeScript strict) storefront that serves product detail and CMS pages from Magento, replacing PWA Studio for those routes. Every page is rendered dynamically; no ISR or data cache is used.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 11 (pinned through the `packageManager` field; enable with `corepack enable`)

## Getting started

```sh
pnpm install
cp .env.example .env.local   # then fill in real endpoints
pnpm dev
```

## Scripts

| Script            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | Start the development server                 |
| `pnpm build`      | Production build (`output: 'standalone'`)    |
| `pnpm start`      | Serve the production build                   |
| `pnpm lint`       | ESLint (flat config, `eslint-config-next`)   |
| `pnpm typecheck`  | `tsc --noEmit`                               |
| `pnpm test`       | Run unit and integration tests once (Vitest) |
| `pnpm test:watch` | Vitest in watch mode                         |

Tests live in `tests/unit` and `tests/integration`.

## Configuration

All configuration comes from server-side environment variables, validated with zod in `src/shared/config/env.ts` on first use, so `pnpm build` does not need them. See `.env.example` for every variable, its default, and its meaning.

## Observability

- Logs: JSON lines via pino (`src/shared/observability/logger.ts`).
- Metrics: CloudWatch Embedded Metric Format lines on stdout (`src/shared/observability/metrics.ts`).
