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

| Script                  | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Start the development server                                                                 |
| `pnpm build`            | Production build (`output: 'standalone'`)                                                    |
| `pnpm start`            | Serve the production build                                                                   |
| `pnpm lint`             | ESLint (flat config, `eslint-config-next`)                                                   |
| `pnpm typecheck`        | `tsc --noEmit`                                                                               |
| `pnpm test`             | Run unit tests once (Vitest, fast)                                                           |
| `pnpm test:integration` | Build, start the real server against mock Magento/CHAPI HTTP servers, and test the PDP cases |
| `pnpm test:watch`       | Vitest in watch mode                                                                         |

Unit tests live in `tests/unit`; server-level tests live in `tests/integration` (set `PDP_IT_SKIP_BUILD=1` to reuse an existing `.next` build).

## Catch-all route (`src/app/[...path]/page.tsx`)

Every path not matched elsewhere is looked up once with Magento `route()` before anything is sent:

| Magento says                  | Visitor | Response                                                                                                                    |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Redirect (301/308 or 302/307) | any     | HTTP 308 / 307 to the target (self-redirects are ignored)                                                                   |
| CMS page                      | any     | CMS renderer (placeholder until T6, noindex)                                                                                |
| Category                      | any     | 404 (phase 1 serves no categories)                                                                                          |
| Product                       | user    | 200, indexable, canonical from Magento; copy mutation after the response                                                    |
| Product                       | bot     | 200, indexable, no mutation                                                                                                 |
| No entity, product-shaped url | user    | 200 `noindex, follow` shell; scraped product streamed in `<Suspense>`, then copy mutation; unavailable state on any failure |
| No entity, product-shaped url | bot     | 404, no scraper call, no mutation                                                                                           |
| No entity, other url          | any     | 404                                                                                                                         |
| Magento failure               | any     | 5xx, never 404                                                                                                              |

Indexability depends only on Magento existence; bot status only gates the scraper API and the mutation. There is no `loading.tsx` for this segment, since it would commit a 200 before the decision. `htmlLimitedBots: /.*/` keeps robots and canonical in the initial `<head>` for every user agent.

## Configuration

All configuration comes from server-side environment variables, validated with zod in `src/shared/config/env.ts` on first use, so `pnpm build` does not need them. See `.env.example` for every variable, its default, and its meaning.

## Images

`next/image` optimizes only hosts listed in `IMAGE_REMOTE_HOSTS` (build time, comma-separated `host` or `host/path/**`; defaults: `chupaprecios.com.mx/media/**`, `i.ebayimg.com`, `m.media-amazon.com`, `target.scene7.com`). Other hosts render unoptimized.

## Observability

- Logs: JSON lines via pino (`src/shared/observability/logger.ts`).
- Metrics: CloudWatch Embedded Metric Format lines on stdout (`src/shared/observability/metrics.ts`). Page metrics: `BotRequest` (`Page`), `PdpOutcome` (`Case` = exists_user, exists_bot, missing_user, missing_bot), `PdpScrapedOutcome` (`Outcome`), plus the adapter metrics.
