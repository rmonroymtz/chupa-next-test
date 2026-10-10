# Phase 1 storefront — product pages and CMS

## Objective
Next.js (App Router, RSC, TS strict) storefront that replaces PWA Studio for product detail pages (PDP) and CMS pages, removing the third-party prerender dependency for those routes.

## Problem / why
PWA Studio has severe SEO issues and relies on an external prerender service. Phase 1 migrates PDP + CMS behind same-domain path routing (nginx/CloudFront).

## Scope (authorized)
- Magento GraphQL integration (`route`, products, cmsPage, storeConfig, `processSku`).
- Internal scraper API (CHAPI) integration: `POST /api/v1/product/`, `/api/v1/product/variants/` (search is phase 3).
- PDP flow, 4 cases (exists/not exists × user/bot), copy mutation via `after()`.
- Bot detection (env-configurable UA list).
- CMS pages with Page Builder (server parser + RSC components; slider/tabs client).
- Technical SEO: metadata, canonical, OG, JSON-LD, robots.txt.
- Shared cart with PWA Studio (localStorage `M2_VENIA_BROWSER_PERSISTENCE__*`).
- Header/footer consistent with PWA theme tokens.
- Observability (structured logs + CloudWatch EMF metrics), Dockerfile, routing docs.

Out of scope: any caching, Magento/API changes, translation, rate limiting, categories/home/search (later phases).

## Constraints
- Every page dynamic (no ISR, no data cache; `cache: 'no-store'`).
- All Magento/CHAPI calls server-side only.
- All tunables via env vars (zod-validated).
- Indexability identical for every visitor: exists in Magento → indexable; not → noindex.
- Mutation never blocks response, has its own timeout, failures only logged.

## Verified contracts (see Engram `discovery/chupa-next-test-contracts`)
- `route(url)` resolves `|` and `%7C` identically; canonical uses literal `|` (matches Magento `relative_url` and sitemaps).
- URL: `/{vendor}-{sku}-{slug}.html`, vendor ∈ amazon|ebay|target|acme (API also lists walmart|homedepot); acme sku base64url; eBay variant via `?var=<id>` → `sku|var`; `normalizeSku` collapses `X|X`.
- `engine_id` = `storeConfig.engine_settings[service_fallback[store] + "_engine"]`.
- Cart: `addProductsToCart(cartId, [{sku, quantity, vendor}])`, `createEmptyCart`; storage value `JSON.stringify({value: JSON.stringify(v), timeStored, ttl})`, signin_token ttl 3600.

## Delivery strategy
`ask-on-risk` — forecast well above 400 authored lines; chain strategy: `stacked-to-main` (user, 2026-10-09). Slices: S1 = T1+T2, S2 = T3, S3 = T4+T5, S4 = T6, S5 = T7+T8, S6 = T9 (adjusted as work lands).

## Tasks
Route per task: delegated (writer trigger: 2+ non-trivial files) unless noted.

- [x] T1 Scaffold: Next 16 + React 19 + TS strict + pnpm, ESLint, Vitest, env config (zod), logger + EMF metrics, Tailwind v4. Check: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [x] T2 Domain (TDD): product URL parse/normalize/extract (real cases, acme, `?var`, `%7C`), indexability rule, bot detector. Check: unit tests RED→GREEN.
- [x] T3 Infrastructure: GraphQL client with timeouts, Magento route resolver, product repo, storeConfig engine settings, copy-mutation adapter, CHAPI gateway, mock adapters. Check: unit tests with MSW.
- [x] T4 PDP flow: catch-all route, 4 cases, Suspense streaming, unavailable state, `after()` mutation, noindex/404. Check: integration tests (4 cases).
- [x] T5 SEO: metadata builders, JSON-LD (Product/Offer/BreadcrumbList/Organization/WebSite), robots.txt. Check: unit tests (price parity).
- [ ] T6 Page Builder parser + RSC components + CMS page + products content type, safe fallback. Check: parser unit tests.
- [ ] T7 Layout: header/footer, theme tokens, self-hosted fonts, next/image remote config.
- [ ] T8 Cart: PWA storage compat, add-to-cart, mini-cart (client). Check: unit tests + Playwright e2e scaffold (PDP → cart → PWA checkout).
- [ ] T9 Dockerfile (standalone), ECS notes, routing rules doc, phase report.

## Acceptance criteria
All checks above green; 4-case integration tests pass; phase report delivered (built, decisions, pending, risks).

## Progress / evidence
- T1 (delegated, writer trigger: 15+ config/source files): install/typecheck/lint/test (20 passed)/build all exit 0; parent spot check `pnpm test` 20 passed. Next 16.4.0, React 19.3.0, TS 6.0.3 (typescript-eslint caps <6.1), ESLint 9. Root layout `dynamic = 'force-dynamic'`. Commit: 008dc76.
- T2 (delegated, writer trigger: 3 new modules + tests): RED observed (3 suites import-fail, 3 env tests); GREEN typecheck/lint 0, 92 tests passed; parent spot check 92 passed. Bot detector: substring + guarded regex, empty UA = bot. `PRODUCT_VENDORS` env added. PENDING: `.env.example` line `PRODUCT_VENDORS=amazon,ebay,target,acme` (permission rule denies agent access to .env*). Commits: 05b68d3, fix f/up 6d45edb. RDD: medium, review granted → approved (lineage review-98f0c44d037a8180, acknowledged/burned). Two advisory findings (regex lowercasing inverted \\S/\\D; ?var applied to all vendors) fixed test-first in follow-up commit (94 tests). Reviewed boundary → 05b68d3.

## Known risks (out of scope)
- No cache: every visit hits Magento.
- acme SKUs whose base64url contains `-` cannot be split reliably when the product is not in Magento.
- Link previews empty while Magento copy not yet created.
- Status differs by UA for non-existing products (200 noindex vs 404); CDN cache key must account for it.

- T3 (delegated, writer trigger: 5 adapters + ports): RED per suite; typecheck/lint/build ok; 166 tests; parent spot check 166. Commits d2fa3cb, 2e52c30. Live: products(url_key) misses `|` keys → product read via route(); prices already MXN; engines ebay=api, others=direct; CHAPI not-found shape UNVERIFIED (assumed empty data/404). RDD medium granted → approved, acknowledged (lineage review-e1aa36c6eff218ab); boundary → 2e52c30. Advisory: R3-001 false positive (regex has 'i' flag), R3-002 false positive (msw 3 uses onUnhandledFrame), R3-003 redirect with empty target can self-loop, R3-004 CHAPI optional fields too strict → folded into T4 as follow-ups.
- PENDING .env.example lines: MAGENTO_STORE_CODE=default, MAGENTO_CURRENCY=MXN, PRODUCT_VENDORS=amazon,ebay,target,acme.

- T4 (delegated, writer trigger: route + service + ~12 UI files + harness): RED observed (22 follow-up tests, service/loader/ui suites); typecheck/lint/build ok; 236 unit + 13 integration (real standalone server vs mock Magento/CHAPI), passed twice; parent spot check integration 13 passed. Commits a503996 (R3-003/R3-004 follow-ups), fc93b1d (PDP + integration suite). Next 16.4 quirk: catch-all params decoded in generateMetadata, encoded in page → normalized. htmlLimitedBots /.*/ → blocking metadata for all UAs, Suspense still streams. RDD medium granted → approved (lineage review-1ac5176d3bf03290); boundary → fc93b1d. Advisory → T5: R3-001 image URLs with query rejected by optimizer, R3-002 wall-clock ordering assertion flaky, R3-003 CMS placeholder noindex not asserted.
- PENDING .env.example: IMAGE_REMOTE_HOSTS (build-time).

- T5 (delegated): RED observed (image-hosts 16, new suites import-fail, metadata 4); typecheck/lint/build ok; 287 unit, 18 integration ×2; parent spot check 287. Commits 52a2d10 (T4 advisories: query-string images unoptimizable, server-side ordering via TCP proxy + seq counter, CMS noindex asserted), c1b0559 (metadata, JSON-LD, single getDisplayPrice for price parity, robots.txt). Breadcrumb category links → /search.html?query= (blocked by robots Disallow /*?*, documented). RDD medium granted → approved (acknowledged); boundary → c1b0559. Advisory (not fixed, low risk): ordering proxy stamps could share a poll iteration.
- Slice S3 (T4+T5) ready for PR (push/PR are user decisions).
- PENDING .env.example: ORGANIZATION_LOGO_URL, ORGANIZATION_SAME_AS (optional).

## Next step
T6 Page Builder + CMS.
