# Phase 1 report: product and CMS pages on Next.js

Phase 1 delivers a Next.js 16.4 storefront (App Router, Server Components, TypeScript strict) that serves **product detail pages and CMS pages** from Magento, removes the prerender dependency for those routes, and shares the cart with PWA Studio on the same domain. It is ready to deploy behind nginx or CloudFront; go-live needs the pending items below.

## At a glance

| Area                                                     | Status                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Product pages (4 cases: exists/missing × shopper/bot)    | Done                                                                         |
| CMS pages with Page Builder                              | Done                                                                         |
| Technical SEO (metadata, canonical, JSON-LD, robots.txt) | Done                                                                         |
| Header/footer with PWA theme                             | Done                                                                         |
| Shared cart (add to cart, mini cart)                     | Done                                                                         |
| Observability (JSON logs, CloudWatch EMF metrics)        | Done                                                                         |
| Container, ECS notes, routing rules                      | Done (`Dockerfile`, `docs/deploy/ecs-fargate.md`, `docs/routing/phase-1.md`) |
| Real-environment checks                                  | Pending (see below)                                                          |

## What was built

| Module              | What it does                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/[...path]` | One catch-all route: Magento `route()` decides product, CMS, redirect or 404 before anything is sent. Magento failure is 5xx, never 404.                                                                     |
| `product`           | URL parsing (`/{vendor}-{sku}-{slug}.html`, `                                                                                                                                                                | `/`%7C`, acme base64url, eBay `?var=`), Magento product read, scraper API (CHAPI) gateway, copy mutation after the response (`after()`), indexability rule, page UI with streamed scraped product. |
| `bot-detection`     | Env-configurable User-Agent list (substrings or guarded regex). Bots never trigger the scraper or the mutation.                                                                                              |
| `cms`               | `cmsPage` read (one request per page, shared by metadata and page), 404 when Magento reports it missing.                                                                                                     |
| `page-builder`      | Server-side parser (parse5) replacing the legacy client renderer; Server Components for every content type, client slider and tabs; products content type; defensive directive handling; per-node isolation. |
| `seo`               | Metadata builders, JSON-LD (Product/Offer/BreadcrumbList/Organization/WebSite), `robots.txt` with the production rules.                                                                                      |
| `layout`            | Header (search form, store tabs, category menu streamed with its own timeout) and footer; legacy theme tokens; self-hosted fonts.                                                                            |
| `cart`              | PWA browser-storage compatibility, add to cart and mini cart through Server Actions only, cart recovery, GA4 event.                                                                                          |
| `shared`            | zod-validated env, GraphQL client with timeouts and metrics, pino logger, EMF metrics, image host config, Server Action allowed origins.                                                                     |
| Ops                 | Multi-stage `Dockerfile` (non-root), `/healthz` liveness route, ECS Fargate and routing docs.                                                                                                                |

Tests: unit (Vitest), integration against the real standalone server with mock Magento/CHAPI, Playwright shared-cart suite. See `README.md` for the commands.

## Key decisions

| Decision                                                      | Why                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page dynamic; no ISR, no data cache, `no-store` fetches | Scope: caching is out of phase 1.                                                                                                                                                                     |
| Indexability depends only on Magento existence                | Same answer for every visitor; bots only change whether the scraper and mutation run.                                                                                                                 |
| Missing product: shopper 200 `noindex`, bot 404               | Shoppers still see the scraped product; crawlers do not index it.                                                                                                                                     |
| `htmlLimitedBots: /.*/`                                       | Robots and canonical are always in the initial `<head>`, for every user agent.                                                                                                                        |
| Canonical keeps a literal `                                   | `                                                                                                                                                                                                     | Matches Magento `relative_url` and the sitemaps. |
| Product read through `route()`, not `products(url_key)`       | `products(url_key)` cannot find keys containing `                                                                                                                                                     | ` (verified live).                               |
| Server Actions only, no `/api` routes                         | The edge sends `/api/*` to the scraper API; the browser never calls Magento or CHAPI.                                                                                                                 |
| Cart in PWA storage format, `signin_token` read-only          | Checkout stays on PWA; the cart must survive the hop.                                                                                                                                                 |
| Empty 404 shell accepted (user decision, 2026-10-11)          | Next 16.4 cannot server-render a page-level `notFound()` in dynamic rendering; status 404 and `noindex` are correct, content renders client-side. A characterization test flags a future Next change. |
| Liveness without dependency checks                            | A slow Magento must not make ECS replace every task (cascading failure).                                                                                                                              |
| Debian slim base image                                        | `sharp` glibc binaries are the best-tested path.                                                                                                                                                      |
| Delivery: stacked PRs to `main`                               | Feature well above the 400-line review budget.                                                                                                                                                        |

## Pending before go-live

- [ ] **`.env.example` lines** (agents cannot edit `.env*`; some may already be in the user's uncommitted changes): `MAGENTO_STORE_CODE=default`, `MAGENTO_CURRENCY=MXN`, `PRODUCT_VENDORS=amazon,ebay,target,acme`, `IMAGE_REMOTE_HOSTS=` (build time), `ORGANIZATION_LOGO_URL=`, `ORGANIZATION_SAME_AS=`, `SERVER_ACTIONS_ALLOWED_ORIGINS=` (build time).
- [ ] **CHAPI not-found response shape is unverified.** The gateway assumes empty `data` or HTTP 404; confirm with the scraper API team.
- [ ] **Real-environment e2e**: `e2e/pwa-checkout.spec.ts` needs `E2E_BASE_URL` (and `E2E_PRODUCT_PATH`) against an environment with the routing in place.
- [ ] **CMS path list** for the edge, generated from Magento (see the routing doc).
- [ ] **Edge checks**: no category/CMS url key of the form `{vendor}-*.html`; forwarded host and real `User-Agent` reach Next.
- [ ] **Load test** to replace the starting CPU/memory sizes and to measure Magento load.

Accepted gaps (documented, not blocking):

- 404 pages render their content client-side (see decisions).
- Scraped product variants are not rendered (no variant selector for scraped products).
- The Page Builder products content type misses products whose url key contains `|` (legacy parity).
- Not replicated from PWA: search autocomplete, remembered store, SKU search shortcut, removing items from the mini cart, cross-tab count sync.

## Risks

Known before phase 1 (out of scope), re-checked:

| Risk                                                                                      | Status                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No cache: every visit hits Magento                                                        | **Confirmed, larger than expected.** Each page runs `route()` plus the product or `cmsPage` read, `storeConfig` when needed, and the header menu query on every request. |
| acme SKUs whose base64url contains `-` cannot be split when the product is not in Magento | Confirmed, unchanged.                                                                                                                                                    |
| Link previews empty while the Magento copy is not created                                 | Confirmed, unchanged (scraped data never feeds metadata).                                                                                                                |
| Status differs by UA for missing products (200 vs 404)                                    | Confirmed. Any CDN cache key must separate bots from shoppers, or not cache these pages.                                                                                 |

Discovered during phase 1:

| Risk                                                                                    | Impact                                                                                                                    | Mitigation                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Categories are search pages (`/search.html?query=…`) blocked by robots `Disallow: /*?*` | Breadcrumb and menu category links are not crawled.                                                                       | Phase 2 (categories).                                                            |
| Server Action origin check behind a proxy                                               | Add to cart fails if the proxy does not forward the public host.                                                          | `X-Forwarded-Host`, or `SERVER_ACTIONS_ALLOWED_ORIGINS` at build time.           |
| Build needs network                                                                     | `next/font` downloads Google fonts during `pnpm build`; offline builds fail.                                              | Build where the registry and Google Fonts are reachable.                         |
| Magento `products(url_key)` cannot find `                                               | ` keys                                                                                                                    | Products read via `route()` instead; products content type keeps the legacy gap. | A `route()` per item would fix it at one request per product. |
| Runtime env validated on first use                                                      | A bad value passes `/healthz` and fails pages with 5xx.                                                                   | Check the first page after each deploy (ECS doc checklist).                      |
| CloudFront replaces the `User-Agent` with `Amazon CloudFront` unless forwarded          | Every visitor, crawlers included, would be treated as a shopper: crawlers would trigger scraper calls and copy mutations. | Forward `User-Agent` in the origin request policy.                               |

## Next step

Merge the stacked PRs, add the `.env.example` lines, generate the CMS path list, deploy to a staging environment with the routing rules, then run the real-environment e2e and a load test.
