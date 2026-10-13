# Phase 2 storefront — categories and home

Status: discovery done, **blocked on product decisions** (see "Open decisions"). No source code written yet.
Branch: `feat/phase-2-categories-home` (from `main` after the phase 1 merge, PRs #1–#8).

## Objective

Serve category pages and the home page from the Next.js storefront, replacing the PWA Studio routes behind the
CloudFront strangler routing, following the same constraints as phase 1.

## Problem / why

- Category links in the menu point to `/search.html?query=<category>&store=amazon`, which robots blocks
  (`Disallow: /*?*`), so categories are not crawled (`docs/phase-1-report.md:84`, mitigation "Phase 2 (categories)").
- The home page in Next is a placeholder (`src/app/page.tsx`, `docs/routing/phase-1.md:65`).

## Scope (to confirm)

There is no written phase 2 requirement. The original spec summary (Engram #606) only says "4 phases (1: PDP+CMS)".
"Phase 2 = categories + home" and "search = phase 3" are inferred from `odd/tasks/phase-1-storefront.md:11,20` and
`docs/phase-1-report.md:84`. **The user must confirm the scope.**

## Constraints carried over from phase 1

- No Magento or API changes; no translation; no rate limiting (`odd/tasks/phase-1-storefront.md:20`).
- No cross-request caching: routes are `force-dynamic` (`src/app/layout.tsx:16`, `src/app/[...path]/page.tsx:28`),
  GraphQL and CHAPI fetch with `cache: 'no-store'` (`src/shared/graphql/client.ts:125`,
  `src/modules/product/infrastructure/chapi-gateway.ts:52-53`). Only per-request React `cache()` dedupe.
- Magento and CHAPI are called only from the server (Server Components / Server Actions, never `/api` routes: the edge
  sends `/api/*` to the scraper).
- Same indexability for every visitor; bots never trigger CHAPI or the copy mutation (`docs/phase-1-report.md:24`).
- Links to PWA routes are plain `<a>`, not `next/link` (`src/modules/layout/domain/legacy-routes.ts`).
- All tunables are zod-validated env vars (`src/shared/config/env.ts`).
- Conventions: hexagonal modules `src/modules/<m>/{domain,application/ports.ts,infrastructure,ui}`; tests in
  `tests/unit/modules/<m>`, `tests/integration`, `e2e/`; fixtures in `tests/fixtures/{magento,chapi,page-builder}`.
- Delivery: stacked PRs to `main`, one per task, ~400 authored lines per slice (review budget).

## What exists (reusable)

- Routing: `route()` already classifies categories (`src/modules/routing/domain/route.ts:10`, `route-mapper.ts:35`);
  the product lookup returns `kind: 'category'` (`src/modules/product/application/ports.ts:153`) and is turned into a
  404 on purpose (`product-page-service.ts:112-114`). The catch-all `src/app/[...path]/page.tsx:55` can take a
  `category` branch.
- Category tree: `CategoryTreeRepository` and `HEADER_MENU_QUERY` (3 levels + `category_url_suffix`) in the `layout`
  module; `buildCategoryMenu` builds `searchHref` and `categoryHref` (`layout/domain/category-menu.ts:55-56`).
  Desktop top level and all mobile levels link to `searchHref`, desktop submenus to `categoryHref`
  (`category-nav.tsx:34,45,52,105`).
- Search URLs: `buildCategorySearchUrl`, `CATEGORY_SEARCH_STORE = 'amazon'` (`layout/domain/search.ts:53,62`);
  breadcrumb JSON-LD `categoryUrl()` points to `/search.html?query=` (`product/ui/product-structured-data.ts:129`).
- CHAPI gateway (`product/infrastructure/chapi-gateway.ts`): product + variants only, timeout + metrics.
- Store config `resolveEngineId`; CMS page + Page Builder parser/renderer, products content type, slider, tabs; SEO
  metadata builders, `JsonLd`, robots.

## What is missing

- CHAPI search port/adapter (`/api/v1/search/`, contract `{query, store, engine_id, filters, page_size}`, Engram #607).
- Search engine id: legacy uses `engine_settings[`${service_fallback[store]}_search_engine`]`; our
  `STORE_CONFIG_QUERY` only reads `*_engine` (`store-config.query.ts:19`).
- Category page, category repository, product grid UI, `CollectionPage`/`ItemList` JSON-LD.
- Home: Magento `cmsPage(home)` content is empty (meta usable); the PWA home is hard-coded React (banners, vendor
  category banners, `randomProducts` carousels `tendency`/`also_bought`/`recently`); cmsBlocks
  `hero-slider-container` and `top-banner-slider` exist but there is no cmsBlocks repository.
- Routing rules for category URLs and `/`; sitemap stays in Magento.

## Open decisions (ask one at a time, in this order)

1. **What a category page shows** — asked 2026-10-13, unanswered. Recommendation: the CHAPI search result for the
   category keyword (today's behavior) on a clean, indexable URL. Alternative: products Magento assigns to the
   category. Evidence: Engram #607 "Categories are NOT Magento categories".
2. **Category URL scheme** — Magento `/{url_path}.html` (already `categoryHref`, resolvable by `route()`), a new clean
   path, or keep `/search.html?query=`. Check: no category key may look like `{vendor}-*.html`
   (`docs/routing/phase-1.md:47`).
3. **Where the keyword and store per category come from** — `url_path` (today), a repo config file, or
   `randomProducts(keywords)`; a Magento attribute is ruled out by "no Magento changes".
4. **Home content source** — port the PWA sections, CMS page/blocks, or a mix; use `randomProducts` carousels or not.
5. **CHAPI load on category pages** — no caching by spec; every visit would call CHAPI search. Decide on quota/latency
   handling (or accept it).
6. **Indexability / status** — empty category or CHAPI error: 200 noindex or 404? Do bots call CHAPI search?
7. **Pagination and filters** — robots disallows `?p=` and `?*`.

## Draft tasks (finalize after the decisions)

Route per task: delegated (writer trigger: 2+ non-trivial files).

- [ ] T1 Domain: category page model, category URL build/parse, keyword/query resolution, indexability rule. Check: unit RED→GREEN.
- [ ] T2 CHAPI search adapter (+ `*_search_engine` in store config, fixture from the OpenAPI). Check: MSW unit tests (found, empty, timeout, invalid).
- [ ] T3 Category repository (Magento category: name, description, breadcrumbs, meta, children). Check: MSW unit tests.
- [ ] T4 Category page: `category` branch in the catch-all (replaces the 404), streamed product grid, empty/error states, bot policy. Check: integration tests (exists/missing × shopper/bot).
- [ ] T5 Category SEO: metadata, canonical, `CollectionPage`/`ItemList` + BreadcrumbList JSON-LD; menu and breadcrumb links to the new URLs. Check: unit tests.
- [ ] T6 Home data: cmsBlocks repository, optional `randomProducts` repository, `cmsPage(home)` meta. Check: MSW unit tests.
- [ ] T7 Home page: `src/app/page.tsx` sections, metadata, Organization/WebSite JSON-LD. Check: integration test.
- [ ] T8 Ops and docs: phase 2 routing doc (category URLs and `/` to Next, prerender exclusion), env vars, phase 2 report, e2e smoke. Check: `pnpm typecheck lint test test:integration build`.

## Delivery strategy

Same as phase 1: `ask-on-risk`, chain `stacked-to-main`; one PR per task slice.

## Progress

- 2026-10-13: discovery (read-only explorer) done; decision 1 asked. Full environment reference: `docs/environment.md`.

## Next step

Answer decision 1, then 2–7; update the scope and tasks; then start T1.

## Resume on another machine

1. `git fetch origin && git switch feat/phase-2-categories-home`
2. `pnpm install` (Node version in `.nvmrc`).
3. Create `.env.local` from `docs/environment.md` with real `MAGENTO_GRAPHQL_URL`, `CHAPI_BASE_URL`, `PUBLIC_BASE_URL`.
4. Check: `pnpm typecheck && pnpm lint && pnpm test`.
5. Read this file, then continue from "Next step".
