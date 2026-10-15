# Chupaprecios storefront

Next.js (App Router, React Server Components, TypeScript strict) storefront that serves the home page, category pages, product detail and CMS pages from Magento, replacing PWA Studio for those routes. Every page is rendered dynamically; no ISR or data cache is used.

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

| Script                  | Purpose                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Start the development server                                                                                   |
| `pnpm build`            | Production build (`output: 'standalone'`)                                                                      |
| `pnpm start`            | Serve the production build                                                                                     |
| `pnpm lint`             | ESLint (flat config, `eslint-config-next`)                                                                     |
| `pnpm typecheck`        | `tsc --noEmit`                                                                                                 |
| `pnpm test`             | Run unit tests once (Vitest, fast)                                                                             |
| `pnpm test:integration` | Build, start the real server against mock Magento/CHAPI HTTP servers, test PDP and CMS pages                   |
| `pnpm test:e2e`         | Playwright: shared-cart suite on the standalone server + mocks; PWA checkout and phase 2 smoke suites (opt-in) |
| `pnpm test:watch`       | Vitest in watch mode                                                                                           |

Unit tests live in `tests/unit`; server-level tests live in `tests/integration` (set `PDP_IT_SKIP_BUILD=1` to reuse an existing `.next` build). Browser tests live in `e2e/` (Playwright; install the browser once with `pnpm exec playwright install chromium`):

- `e2e/local/`: builds (unless `PDP_IT_SKIP_BUILD=1`), starts mock Magento/CHAPI and the standalone server, adds to cart on a Magento PDP and a scraped PDP, and checks `M2_VENIA_BROWSER_PERSISTENCE__cartId` in the exact PWA format, the mini-cart count and contents, and recovery of a stale cart id.
- `e2e/pwa-checkout.spec.ts`: skipped unless `E2E_BASE_URL` is set. With `E2E_BASE_URL=https://<env>` and `E2E_PRODUCT_PATH=/<vendor>-<sku>-<slug>.html` (an in-stock product served by Next) it adds to cart on the Next PDP, opens PWA Studio `/checkout` on the same domain and checks the cart id survived. It creates a real guest cart; the local stack is not started in this mode.
- `e2e/phase-2-smoke.spec.ts`: read-only, only with `E2E_BASE_URL` and `E2E_PHASE2_SMOKE=1`: `/` 200 with canonical `/` and no `/search.html` menu links; a category 200 with h1, product cards and canonical; `?page=abc` 307 to the clean url; an unknown `.html` 404; the home CMS url 308 to `/`. Paths default to staging examples and are overridable (`E2E_CATEGORY_PATH`, `E2E_HOME_CMS_PATH`, `E2E_UNKNOWN_HTML_PATH`, see `docs/environment.md`); production categories are empty today, so do not point it at production. Example: `E2E_BASE_URL=http://localhost:3000 E2E_PHASE2_SMOKE=1 pnpm test:e2e --project phase-2-smoke`.

## Catch-all route (`src/app/[[...path]]/page.tsx`)

Every path not matched elsewhere, `/` included, is looked up once with Magento `route()` before anything is sent:

| Magento says                  | Visitor | Response                                                                                                                            |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Redirect (301/308 or 302/307) | any     | HTTP 308 / 307 to the target (self-redirects are ignored)                                                                           |
| CMS page                      | any     | 200, indexable, canonical from Magento; Page Builder content rendered on the server (404 if `cmsPage` is gone)                      |
| CMS page = `cms_home_page`    | any     | On `/`: 200, canonical `/`. On its own url: 308 to `/` (query kept)                                                                 |
| Category                      | any     | 200 `index, follow` with products, 200 `noindex, follow` when empty; invalid/out-of-range `?page` 307 to the clean url; 404 if gone |
| Product                       | user    | 200, indexable, canonical from Magento; copy mutation after the response                                                            |
| Product                       | bot     | 200, indexable, no mutation                                                                                                         |
| No entity, product-shaped url | user    | 200 `noindex, follow` shell; scraped product streamed in `<Suspense>`, then copy mutation; unavailable state on any failure         |
| No entity, product-shaped url | bot     | 404, no scraper call, no mutation                                                                                                   |
| No entity, other url          | any     | 404                                                                                                                                 |
| Magento failure               | any     | 5xx, never 404                                                                                                                      |

Indexability depends only on Magento existence; bot status only gates the scraper API and the mutation. There is no `loading.tsx` for this segment, since it would commit a 200 before the decision. `htmlLimitedBots: /.*/` keeps robots and canonical in the initial `<head>` for every user agent.

## Configuration

All configuration comes from server-side environment variables, validated with zod in `src/shared/config/env.ts` on first use, so `pnpm build` does not need them. See `.env.example` for every variable, its default, and its meaning.

## Images

`next/image` optimizes only hosts listed in `IMAGE_REMOTE_HOSTS` (build time, comma-separated `host` or `host/path/**`; defaults: `chupaprecios.com.mx/media/**`, `i.ebayimg.com`, `m.media-amazon.com`, `target.scene7.com`). Other hosts, and any url with a query string, render unoptimized: the remote patterns require an empty query so the optimizer never fetches and stores arbitrary resized or signed vendor variants. `isOptimizableImageUrl` is tested against Next's own pattern matcher so the UI and the optimizer always agree.

## SEO

- **Metadata** (`src/modules/product/ui/product-page-metadata.ts`): products in Magento get title (`meta_title` or name, root template `%s | Chupaprecios`), description (meta description, else short description, plain text, ~160 chars on a word boundary), canonical with a literal `|`, Open Graph (`website`, `es_MX`, gallery images; Magento gives no dimensions) and a `summary_large_image` Twitter card. Pages missing from Magento stay `noindex, follow` with no product claims: scraped data streams after the head and never feeds metadata. CMS pages (`src/modules/cms/ui/cms-page-metadata.ts`) are `index, follow` with `meta_title` (else title), `meta_description`, `meta_keywords`, Open Graph and a canonical from `relative_url` (else `url_key`). `metadataBase` is the runtime `PUBLIC_BASE_URL`.
- **JSON-LD**, server-rendered and escaped by `serializeJsonLd` (`<`, `>`, `&`, U+2028/2029 as unicode escapes):
  - `Product` + `Offer` and `BreadcrumbList` only for products in Magento. The offer price and the visible price both come from `getDisplayPrice` (final price; regular price only shown struck through), currency from Magento, availability `InStock`/`OutOfStock` from `stock_status` (omitted when unknown). Magento exposes no condition, so `itemCondition` is not declared.
  - Breadcrumbs: Inicio → the product's deepest Magento category path → product, with category items pointing to the category pages (`/{url_path}.html`). Category pages add `CollectionPage`/`ItemList` and `BreadcrumbList`.
  - `Organization` and `WebSite` (with a `SearchAction` on `/search.html?query={search_term_string}`) once per page from the root layout; logo and `sameAs` come from `ORGANIZATION_LOGO_URL` and `ORGANIZATION_SAME_AS` (optional).
- **robots.txt** (`src/app/robots.txt/route.ts`): the production rules in the same order, with a single `Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`. Sitemaps keep being served by Magento; the storefront does not generate them.

## CMS pages and Page Builder

`route()` resolves a CMS identifier; the page then reads `cmsPage(identifier:)` once per request (React `cache()` shared by metadata and page, no-store, client timeout and metrics). A Magento failure is a 5xx, never a 404; a page Magento reports as missing (`doesn't exist` GraphQL error or null) is a 404.

`src/modules/page-builder/` replaces the legacy `@magento/pagebuilder` 9.2.1 client renderer:

- **Parser** (`parser/`): [parse5](https://github.com/inikulin/parse5), the WHATWG HTML parser (one dependency, `entities`). It builds the same tree as the browser `DOMParser` the legacy parser used, so malformed content is repaired the same way; lighter parsers (e.g. `node-html-parser`) silently drop unclosed tags. Detection, the content-type walk and every `configAggregator` are replicated; `<style>` blocks (`#html-body [data-pb-style=ID]`) are merged into inline styles and their `@media` rules re-emitted in one scoped `<style>`. Content without `data-content-type` renders as one HTML block, like legacy RichContent.
- **Trusted HTML**: CMS HTML is admin content, but server-rendered `<script>` would run (legacy `innerHTML` never ran it), so scripts, `on*` handlers and `javascript:` urls are removed; images get `loading="lazy"`.
- **Directives**: verified live (2026-10-10, `cmsPage(home)`, three CMS pages via `route()`, two CMS blocks): Magento returns content already filtered (absolute media urls, no `{{...}}`). Defensively, `{{media url=...}}` resolves against `storeConfig.secure_base_media_url`; any other directive is removed and logged (`page builder directives stripped`). A quote-aware scanner (`application/strip-directives.ts`) then removes anything the resolver's regex misses, such as a `}` inside a quoted argument, and is also the fallback when resolving fails.
- **Rendering** (`ui/`): Server Components with a CSS module ported from the legacy CSS modules (plus the project Text/Slider overrides and the Venia button). Only the slider and tabs are Client Components (no carousel library; WAI-ARIA carousel/tabs patterns; autoplay pauses on hover/focus, has a pause button and never starts with `prefers-reduced-motion`). Every top-level node renders in isolation: a failing node is logged and left out. On the real server a node that throws while React renders it falls back to its own Suspense boundary (client rendering, then the node error boundary drops it) and the page stays 200 (`tests/integration/cms.test.ts`). Unknown content types render their children and are logged once per page.
- **Images**: `next/image` (`getImageProps`) optimizes Magento media when `data-image-dimensions` is present; without dimensions (Magento's default master format) the original file renders at its natural size, lazy, as legacy did (requesting a width would upscale small images). Background images are CSS variables swapped at the legacy 768px breakpoint, through the image optimizer for Magento media. The first top-level node's first image or background is treated as the LCP candidate (eager, `fetchPriority="high"`, preloaded when it has a single url): best effort, not measured.
- **Products content type**: product links (`.product-item-details > .product-item-name > a.product-item-link`) → last path segment without `product_url_suffix` → one `products(filter: {url_key: {in}})` query for the whole page, cards in admin order with the PDP price (`getDisplayPrice`). Grid: 5 columns (2 on mobile); carousel: CSS scroll-snap region (5/4/2 per view), no JavaScript. A failed query hides the cards (legacy hid them too). Limitation kept from legacy: url keys containing `|` are not matched by `products(filter: url_key)` (verified in T3), so those products do not show; a `route()` call per item would fix it at one Magento request per product and was not added.
- **Degraded on purpose**: parallax and video backgrounds render as static backgrounds (video uses its fallback image); maps render a static list of locations linking to Google Maps (no API key); full-bleed rows use the page width (the CMS page is full width) instead of `100vw` tricks; `dynamic_block` content comes from an Adobe Commerce-only `dynamicBlocks` query and is not rendered unless Magento inlined it; videos use `youtube-nocookie.com` / Vimeo `dnt=1` lazy iframes.

## Layout (header, footer, theme)

`src/modules/layout/` renders the header and footer of the legacy PWA Studio site, since both apps share the domain during the migration.

- **Theme**: tokens from `@chupaprecios/pwa-ch-theme` ported to Tailwind v4 `@theme` in `src/app/globals.css` with legacy names (`brand-red`, `marketplace-amazon`, `neutral-black-base`, `ch-dark-grey`, `max-w-site`, `container-padded`...). The legacy type scale replaces Tailwind's (`text-2xl` is 2.125rem, every step line-height 1.5); legacy named spacing is not ported (it would change `max-w-sm`/`max-w-md` in Tailwind v4).
- **Fonts**: `next/font/google` downloads Roboto Flex (base), Noto Sans (desktop menu) and Montserrat (footer) at build time and serves them from `/_next/static/media` (no request to Google from the browser; the build needs network). Variable fonts, latin subset, `display: swap` with metric-adjusted fallbacks; only Roboto Flex is preloaded.
- **Header**: logo, a plain GET search form to `/search.html` (`query`, `store`, `page=1`; store tabs ChupaChoice/Amazon/eBay/Target/Acme as radio buttons, CSS only), sign-in, the mini-cart trigger (`data-slot="cart-trigger"`, see below) and the category menu. The menu comes from one `HeaderMenu` Magento query per request (legacy `getMegaMenu` + `category_url_suffix`; `include_in_menu` filter and `position` order like legacy; own timeout `MAGENTO_MENU_TIMEOUT_MS`, default 1500 ms). It streams in Suspense boundaries with same-size placeholders, so it never delays the page or changes its status, and on any failure the header renders without categories. Every level, desktop and mobile (`<details>`, no JS), links to the category page (`categoryHref`); the desktop menu scrolls horizontally with arrows when it overflows.
- **Links**: header/footer links are plain `<a>` (full navigation, no Next prefetch), as for product links: many target pages PWA Studio serves, and the edge decides the origin per url.
- **Not replicated**: search autocomplete, remembering the last store (`currentStoreSearcher` in browser storage) and the SKU shortcut to `/{store}-{sku}-search.html`; PWA Studio pages keep them.
- **Assets**: `public/images/layout/` (logo, cart, store and payment logos, AMVO seal), converted from the legacy inline SVG components. With `output: 'standalone'`, deployments must copy `public/` and `.next/static/` next to `server.js` (the integration harness does).

## Cart shared with PWA Studio

While checkout stays on PWA Studio (same domain), the cart and session live in PWA Studio's browser storage, read and written in its exact format (`src/modules/cart/domain/browser-persistence.ts`, from peregrine `simplePersistence.js`): key `M2_VENIA_BROWSER_PERSISTENCE__<name>`, value `JSON.stringify({ value: JSON.stringify(v), timeStored, ttl })`, expired when `ttl` is truthy and `now - timeStored > ttl * 1000`.

- **Browser** (`src/modules/cart/ui/`): two client islands. `AddToCart` on both PDP kinds and `MiniCart` in the header slot. They read `cartId` and, when unexpired, the read-only `signin_token`. The storefront writes `cartId` only when it created the cart (no `ttl`, like peregrine `saveCartId`); it never writes, refreshes or removes `signin_token`, and leaves expired items for PWA Studio to clean. Unavailable storage degrades to "no cart".
- **Server** (`src/modules/cart/ui/cart-actions.ts`): Server Actions are the only path to Magento; the browser never calls Magento or the scraper API. There is no `/api/*` route, since the edge proxies that prefix to the scraper API. Inputs are validated with zod. Tokens and cart ids are never logged, and nothing is cached. The signed-in token goes in `Authorization: Bearer` like the PWA auth link.
- **Operations** (legacy GraphQL, `src/modules/cart/infrastructure/cart.queries.ts`): `createCart { cartId: createEmptyCart }`, `AddProductToCart` (`addProductsToCart(cartId, [{ sku, quantity, vendor, selected_options? }])` with `cart { total_quantity }` and `user_errors`), `getItemCount` (count on page load when a cart id exists) and `MiniCartQuery` (when the drawer opens).
- **Recovery** (peregrine `isInvalidCart`): when Magento answers `Could not find a cart`, `The cart isn't active` or `The current user cannot perform operations on cart`, add to cart creates a new cart, retries once, and the browser stores the new id. A freshly created cart is never retried. Unlike peregrine, a signed-in shopper is not signed out (the token is read-only here). Reads with a rejected id show an empty cart and leave storage alone.
- **Add-to-cart rules** (`src/modules/cart/domain/add-to-cart.ts`, from the legacy `useProductFullDetail` override):
  - `vendor` is `pathname.split('-')[0]` without its first character.
  - Scraped products send the scraper `asin` as `sku`, are never blocked on stock (legacy forces `IN_STOCK`), and cap the quantity at the scraper stock when it is ≥ 1.
  - Magento products are blocked when out of stock.
  - Configurable products need every option. They send `selected_options` uids and are blocked when the selected variant (or every variant) is out of stock.
  - No price is validated: Magento's `user_errors` are shown as returned.
  - On success the GA4 `add_to_cart` event of the legacy GTM handler is pushed when `window.dataLayer` exists.
- **Mini cart**: the trigger keeps the legacy accessible name and a `99+` badge, and announces count changes in a polite live region. A native modal `<dialog>` drawer lists items (variant options, quantity, unit price), the `subtotal_excluding_tax` and plain links to `/checkout` and `/cart`.
- **Metrics**: `CartAddToCart` (`Outcome` = success, user_error, failure), `CartCreated` (`Reason` = missing, recovery), `CartRecovered`, `CartReadFailure` (`Operation`, `Outcome`), plus `MagentoLatency`/`MagentoError` per operation.
- **Not replicated**: removing items from the mini cart (PWA cart page), the scraped variant selector and its "selected variant unavailable" check (the PDP does not render scraped variants yet), live count sync with other tabs.
- **Deployment**: Server Actions post to the page url (home, category, PDP or CMS path), so those paths must reach Next for `POST` too. Behind a proxy that rewrites `Host`, Next's Server Action origin check needs `X-Forwarded-Host` to match the browser origin; when the proxy cannot send it, build with `SERVER_ACTIONS_ALLOWED_ORIGINS` (comma-separated hosts, `*.` wildcards; it feeds `experimental.serverActions.allowedOrigins`).

## Deployment

- **Image**: `Dockerfile` (multi-stage, `node:24-bookworm-slim`, non-root, `node server.js` on port 3000). `docker build -t chupa-storefront .`; the build needs network for `next/font`. `IMAGE_REMOTE_HOSTS` and `SERVER_ACTIONS_ALLOWED_ORIGINS` are build arguments; every other variable is runtime.
- **Liveness**: `GET /healthz` answers `200 ok` (`no-store`) without calling Magento or the scraper API, so a Magento outage never makes the orchestrator recycle every task.
- **ECS Fargate**: task definition, environment variables, logs/metrics and shutdown in [`docs/deploy/ecs-fargate.md`](docs/deploy/ecs-fargate.md).
- **Routing** (nginx / CloudFront): [phase 1](docs/routing/phase-1.md) (products, CMS), [phase 2](docs/routing/phase-2.md) (home, categories). Phase summaries: [phase 1](docs/phase-1-report.md), [phase 2](docs/phase-2-report.md).

## Observability

- Logs: JSON lines via pino (`src/shared/observability/logger.ts`).
- Metrics: CloudWatch Embedded Metric Format lines on stdout (`src/shared/observability/metrics.ts`). Page metrics: `BotRequest` (`Page`), `PdpOutcome` (`Case` = exists_user, exists_bot, missing_user, missing_bot), `PdpScrapedOutcome` (`Outcome`), plus the adapter metrics.
