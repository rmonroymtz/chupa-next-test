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

`next/image` optimizes only hosts listed in `IMAGE_REMOTE_HOSTS` (build time, comma-separated `host` or `host/path/**`; defaults: `chupaprecios.com.mx/media/**`, `i.ebayimg.com`, `m.media-amazon.com`, `target.scene7.com`). Other hosts, and any url with a query string, render unoptimized: the remote patterns require an empty query so the optimizer never fetches and stores arbitrary resized or signed vendor variants. `isOptimizableImageUrl` is tested against Next's own pattern matcher so the UI and the optimizer always agree.

## SEO

- **Metadata** (`src/modules/product/ui/product-page-metadata.ts`): products in Magento get title (`meta_title` or name, root template `%s | Chupaprecios`), description (meta description, else short description, plain text, ~160 chars on a word boundary), canonical with a literal `|`, Open Graph (`website`, `es_MX`, gallery images; Magento gives no dimensions) and a `summary_large_image` Twitter card. Pages missing from Magento stay `noindex, follow` with no product claims: scraped data streams after the head and never feeds metadata. CMS placeholders are `noindex, follow`. `metadataBase` is the runtime `PUBLIC_BASE_URL`.
- **JSON-LD**, server-rendered and escaped by `serializeJsonLd` (`<`, `>`, `&`, U+2028/2029 as unicode escapes):
  - `Product` + `Offer` and `BreadcrumbList` only for products in Magento. The offer price and the visible price both come from `getDisplayPrice` (final price; regular price only shown struck through), currency from Magento, availability `InStock`/`OutOfStock` from `stock_status` (omitted when unknown). Magento exposes no condition, so `itemCondition` is not declared.
  - Breadcrumbs: Inicio → the product's deepest Magento category path → product. Category pages are not Magento-routed on the current site, so category items point where the legacy menu sends shoppers: `/search.html?query=<url_path>&store=amazon`. Note that robots.txt disallows `/*?*`, so those urls are not crawled.
  - `Organization` and `WebSite` (with a `SearchAction` on `/search.html?query={search_term_string}`) once per page from the root layout; logo and `sameAs` come from `ORGANIZATION_LOGO_URL` and `ORGANIZATION_SAME_AS` (optional).
- **robots.txt** (`src/app/robots.txt/route.ts`): the production rules in the same order, with a single `Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`. Sitemaps keep being served by Magento; the storefront does not generate them.

## Observability

- Logs: JSON lines via pino (`src/shared/observability/logger.ts`).
- Metrics: CloudWatch Embedded Metric Format lines on stdout (`src/shared/observability/metrics.ts`). Page metrics: `BotRequest` (`Page`), `PdpOutcome` (`Case` = exists_user, exists_bot, missing_user, missing_bot), `PdpScrapedOutcome` (`Outcome`), plus the adapter metrics.
