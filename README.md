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
| `pnpm test:integration` | Build, start the real server against mock Magento/CHAPI HTTP servers, test PDP and CMS pages |
| `pnpm test:watch`       | Vitest in watch mode                                                                         |

Unit tests live in `tests/unit`; server-level tests live in `tests/integration` (set `PDP_IT_SKIP_BUILD=1` to reuse an existing `.next` build).

## Catch-all route (`src/app/[...path]/page.tsx`)

Every path not matched elsewhere is looked up once with Magento `route()` before anything is sent:

| Magento says                  | Visitor | Response                                                                                                                    |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Redirect (301/308 or 302/307) | any     | HTTP 308 / 307 to the target (self-redirects are ignored)                                                                   |
| CMS page                      | any     | 200, indexable, canonical from Magento; Page Builder content rendered on the server (404 if `cmsPage` is gone)              |
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

- **Metadata** (`src/modules/product/ui/product-page-metadata.ts`): products in Magento get title (`meta_title` or name, root template `%s | Chupaprecios`), description (meta description, else short description, plain text, ~160 chars on a word boundary), canonical with a literal `|`, Open Graph (`website`, `es_MX`, gallery images; Magento gives no dimensions) and a `summary_large_image` Twitter card. Pages missing from Magento stay `noindex, follow` with no product claims: scraped data streams after the head and never feeds metadata. CMS pages (`src/modules/cms/ui/cms-page-metadata.ts`) are `index, follow` with `meta_title` (else title), `meta_description`, `meta_keywords`, Open Graph and a canonical from `relative_url` (else `url_key`). `metadataBase` is the runtime `PUBLIC_BASE_URL`.
- **JSON-LD**, server-rendered and escaped by `serializeJsonLd` (`<`, `>`, `&`, U+2028/2029 as unicode escapes):
  - `Product` + `Offer` and `BreadcrumbList` only for products in Magento. The offer price and the visible price both come from `getDisplayPrice` (final price; regular price only shown struck through), currency from Magento, availability `InStock`/`OutOfStock` from `stock_status` (omitted when unknown). Magento exposes no condition, so `itemCondition` is not declared.
  - Breadcrumbs: Inicio → the product's deepest Magento category path → product. Category pages are not Magento-routed on the current site, so category items point where the legacy menu sends shoppers: `/search.html?query=<url_path>&store=amazon`. Note that robots.txt disallows `/*?*`, so those urls are not crawled.
  - `Organization` and `WebSite` (with a `SearchAction` on `/search.html?query={search_term_string}`) once per page from the root layout; logo and `sameAs` come from `ORGANIZATION_LOGO_URL` and `ORGANIZATION_SAME_AS` (optional).
- **robots.txt** (`src/app/robots.txt/route.ts`): the production rules in the same order, with a single `Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`. Sitemaps keep being served by Magento; the storefront does not generate them.

## CMS pages and Page Builder

`route()` resolves a CMS identifier; the page then reads `cmsPage(identifier:)` once per request (React `cache()` shared by metadata and page, no-store, client timeout and metrics). A Magento failure is a 5xx, never a 404; a page Magento reports as missing (`doesn't exist` GraphQL error or null) is a 404.

`src/modules/page-builder/` replaces the legacy `@magento/pagebuilder` 9.2.1 client renderer:

- **Parser** (`parser/`): [parse5](https://github.com/inikulin/parse5), the WHATWG HTML parser (one dependency, `entities`). It builds the same tree as the browser `DOMParser` the legacy parser used, so malformed content is repaired the same way; lighter parsers (e.g. `node-html-parser`) silently drop unclosed tags. Detection, the content-type walk and every `configAggregator` are replicated; `<style>` blocks (`#html-body [data-pb-style=ID]`) are merged into inline styles and their `@media` rules re-emitted in one scoped `<style>`. Content without `data-content-type` renders as one HTML block, like legacy RichContent.
- **Trusted HTML**: CMS HTML is admin content, but server-rendered `<script>` would run (legacy `innerHTML` never ran it), so scripts, `on*` handlers and `javascript:` urls are removed; images get `loading="lazy"`.
- **Directives**: verified live (2026-10-10, `cmsPage(home)`, three CMS pages via `route()`, two CMS blocks): Magento returns content already filtered (absolute media urls, no `{{...}}`). Defensively, `{{media url=...}}` resolves against `storeConfig.secure_base_media_url`; any other directive is removed and logged (`page builder directives stripped`).
- **Rendering** (`ui/`): Server Components with a CSS module ported from the legacy CSS modules (plus the project Text/Slider overrides and the Venia button). Only the slider and tabs are Client Components (no carousel library; WAI-ARIA carousel/tabs patterns; autoplay pauses on hover/focus, has a pause button and never starts with `prefers-reduced-motion`). Every top-level node renders in isolation: a failing node is logged and left out. Unknown content types render their children and are logged once per page.
- **Images**: `next/image` (`getImageProps`) optimizes Magento media when `data-image-dimensions` is present; without dimensions (Magento's default master format) the original file renders at its natural size, lazy, as legacy did (requesting a width would upscale small images). Background images are CSS variables swapped at the legacy 768px breakpoint, through the image optimizer for Magento media. The first top-level node's first image or background is treated as the LCP candidate (eager, `fetchPriority="high"`, preloaded when it has a single url): best effort, not measured.
- **Products content type**: product links (`.product-item-details > .product-item-name > a.product-item-link`) → last path segment without `product_url_suffix` → one `products(filter: {url_key: {in}})` query for the whole page, cards in admin order with the PDP price (`getDisplayPrice`). Grid: 5 columns (2 on mobile); carousel: CSS scroll-snap region (5/4/2 per view), no JavaScript. A failed query hides the cards (legacy hid them too). Limitation kept from legacy: url keys containing `|` are not matched by `products(filter: url_key)` (verified in T3), so those products do not show; a `route()` call per item would fix it at one Magento request per product and was not added.
- **Degraded on purpose**: parallax and video backgrounds render as static backgrounds (video uses its fallback image); maps render a static list of locations linking to Google Maps (no API key); full-bleed rows use the page width (the CMS page is full width) instead of `100vw` tricks; `dynamic_block` content comes from an Adobe Commerce-only `dynamicBlocks` query and is not rendered unless Magento inlined it; videos use `youtube-nocookie.com` / Vimeo `dnt=1` lazy iframes.

## Observability

- Logs: JSON lines via pino (`src/shared/observability/logger.ts`).
- Metrics: CloudWatch Embedded Metric Format lines on stdout (`src/shared/observability/metrics.ts`). Page metrics: `BotRequest` (`Page`), `PdpOutcome` (`Case` = exists_user, exists_bot, missing_user, missing_bot), `PdpScrapedOutcome` (`Outcome`), plus the adapter metrics.
