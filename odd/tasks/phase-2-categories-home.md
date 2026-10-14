# Phase 2 storefront — categories and home

Status: all product decisions taken 2026-10-14 (see "Decisions"); tasks finalized. No source code written yet.
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

- `/` resolved by Magento (optional catch-all), `cms_home_page` in store config, home canonical and redirect.
- CMS override registry and `<CmsBlock>` with a cmsBlocks repository.
- Category page, category + products repository, pagination, product grid UI, `CollectionPage`/`ItemList` JSON-LD.
- Routing rules for category URLs and `/`; sitemap stays in Magento.
- Out of phase 2 (phase 3): CHAPI search adapter and `/search.html`.

## Decisions

1. **What a category page shows** — DECIDED 2026-10-13 (corrected the same day): native Magento categories are
   served by Next with data read directly from Magento (category + its assigned products). **No CHAPI** on category
   pages. These are the pages that must be indexed. The current PWA "categories" (`/search.html?query=…&store=…&page=…`)
   are really searches, not categories; only those use CHAPI search.
2. **Category URL scheme** — DECIDED 2026-10-13: Magento `/{url_path}.html` (already `categoryHref`, resolvable by
   `route()`). Any non-product path goes to Magento. Check: no category key may look like `{vendor}-*.html`
   (`docs/routing/phase-1.md:47`).
3. **Where the keyword and store per category come from** — moot for categories (Magento data, no keyword). Applies
   only to `/search.html`, see decision 8.
4. **Home content source** — asked 2026-10-13, unanswered. Options: (a) mix, recommended: banners from Magento
   cmsBlocks `hero-slider-container`/`top-banner-slider` (editable without deploy), `randomProducts` carousels as in
   the PWA, meta from `cmsPage(home)`; (b) port the PWA home as hard-coded content; (c) cmsBlocks only, no carousels.
   Caveat: the PWA facts come from discovery and are not yet verified against the legacy PWA source-of-truth folder.
   **Superseded 2026-10-14 by a new feature proposed by the user (decision 10).**
10. **Next-overrides-Magento rendering (new feature, proposed 2026-10-14)** — when Magento resolves a URL to an entity
    and Next has a component registered for it, render the Next component; otherwise render the Magento content.
    Magento keeps metadata, 404 and redirects. For the home: turn `src/app/[...path]` into the optional catch-all
    `src/app/[[...path]]` and delete `src/app/page.tsx`, so `/` is resolved by Magento `route()` too.
    - Verified 2026-10-14 (user ran it against Magento): `route(url: "/")` →
      `{"type":"CMS_PAGE","relative_url":"venia-new-home","identifier":"venia-new-home"}`.
    - The real home CMS page is `venia-new-home`, not `home`: the discovery claim "cmsPage(home) content is empty"
      checked the wrong page; `venia-new-home` content is still unknown.
    - Canonical risk: `mapRoute` uses `relative_url` as the page URL, so the home canonical would become
      `/venia-new-home`. Force canonical `/` for the home and decide whether `/venia-new-home` redirects to `/`.
    - DECIDED 2026-10-14: override granularity is **per page** (registry: Magento-resolved entity → Next page
      component; none registered → Magento content). In addition, a reusable component must let a Next page render
      Magento CMS pieces by parts. DECIDED 2026-10-14: a piece is a **Magento CMS block by identifier**
      (e.g. `<CmsBlock identifier="hero-slider-container" />`, `cmsBlocks` query, rendered with the Page Builder
      renderer). Rejected: fragments of the page's own Page Builder content (break when reordered in the admin).
    - DECIDED 2026-10-14: registry key is the **CMS identifier** (e.g. `venia-new-home` → Next component). If
      Magento's configured home changes to another page, the override stops applying and Magento content renders.
      The home canonical is always `/`, derived from the requested URL, never from `relative_url`.
    - DECIDED 2026-10-14: the configured home page's own URL (`/venia-new-home`) answers **301 → `/`**. The home
      identifier comes from `storeConfig.cms_home_page` added to the existing store config query (no extra Magento
      call; field existence to verify in T1).
    - Verified 2026-10-14 (first 1500 bytes of `cmsPage(identifier: "venia-new-home")`): it is NOT empty. It has
      title, `meta_title` "Acceso a más de 300 millones de productos", `meta_description`, empty `content_heading`,
      and Page Builder `content` (row + what looks like a slider of banner slides, `min-height` 440/300px). The
      existing Page Builder parser/renderer may render it as the Magento fallback; unsupported content types still
      unchecked (needs the full content as a fixture under `tests/fixtures/page-builder`).
    - CloudFront still sends `/` to PWA (`docs/routing/phase-1.md:65`); switching it belongs to T8.
5. **CHAPI load on category pages** — moot for categories (no CHAPI). Applies only to `/search.html` if it is in scope.
6. **Indexability / status** — DECIDED 2026-10-14: category missing in Magento → 404 (`not_found`); category exists
   with no products → 200 + `noindex` with an empty state; Magento failure → 5xx (never 404). No CHAPI on category
   pages, so no bot policy is needed for them.
7. **Pagination and filters** — robots disallows `?p=` and `?*`. DECIDED 2026-10-14: like Venia, `?page=N`
   resolved on the server, page size from `storeConfig.grid_per_page`, canonical = clean category URL without page;
   **no filters in phase 2**. DECIDED 2026-10-14: an invalid page (`?page=abc`, `< 1`, or beyond the last page)
   redirects to the clean category URL (page 1).
   Venia reference (`~/Proyectos/pwa-studio`, upstream Magento repo at `190c1cbd`, not necessarily the Chupaprecios
   fork): query param `?page=N`, client-side, forced into the URL with `replace` when missing
   (`peregrine/lib/hooks/usePagination.js`); page size from `storeConfig.grid_per_page`; total from
   `products.page_info.total_pages`; error on page > 1 resets to page 1; filters/sort change resets to page 1
   (`talons/RootComponents/Category/useCategory.js:120-198`); filters as `?<attr>[filter]=<label>,<value>`
   (`talons/FilterModal/helpers.js:19`), `category_uid` always forced; canonical = origin + `url_path` +
   `category_url_suffix`, without page, only when `storeConfig.category_canonical_tag`
   (`venia-ui/lib/RootComponents/Category/category.js:43-58`).
8. **`/search.html` (CHAPI search) in phase 2 or phase 3?** — DECIDED 2026-10-13: phase 3. `/search.html` stays on
   PWA Studio; phase 2 builds no CHAPI search adapter.
9. **Menu links** — DECIDED 2026-10-13: switch every menu level (desktop and mobile) to `categoryHref` so the
   indexable category pages get internal links. `searchHref` is no longer used by the menu.

## Tasks

Route per task: delegated (writer trigger: 2+ non-trivial files). Test-first: RED→GREEN with Vitest + MSW where a
deterministic test exists. Forecast: well over 400 authored lines in total, so one stacked PR per task (see
"Delivery strategy").

- [x] T1 Home through Magento (delegated writer; commit `0e4580f` on `feat/phase-2-01-home-magento`, plus `0c958b6`
  ignoring `.atl/`; typecheck, lint, test 595, test:integration 40, build all green; native review medium, granted,
  approved and acknowledged; Organization/WebSite JSON-LD kept site-wide in `layout.tsx`; redirect is 308 via
  `permanentRedirect`). Review findings fixed in `73108db`: `cms_home_page` normalized from `identifier|page_id`;
  the redirect keeps the query string; the real `venia-new-home` fixture is parsed/rendered in unit and integration
  tests (no parser warnings); `docs/environment.md` synced with `.env.example`. Checks: test 600, integration 41,
  typecheck/lint/build green. Note: the home `products` carousel comes from Magento with no products (empty div),
  so it renders nothing on `/`. Root failure paths covered in `1fe1286` (outage → 5xx, `route: null` → 404,
  CATEGORY → 404 until T4, CMS read failure → 5xx; integration 45). Observed, not investigated: during a Magento
  outage on `/`, one request sends `ProductByRoute` twice (once on success). Visual check 2026-10-14 on the local
  dev server: header, 6-slide slider (desktop and mobile images), footer, no console errors; `/` 200, home CMS url
  308 with query, CMS page 200, unknown url 404. DECIDED 2026-10-14: for now the home shows only the Magento Page
  Builder content; the extra PWA home sections are customizations, out of scope until a later task (T2 registry +
  `<CmsBlock>` make them possible). Original scope: `src/app/[...path]` → `src/app/[[...path]]`, delete `src/app/page.tsx`, `/` resolved
  by `route("/")`; `cms_home_page` in the store config query; home canonical `/` from the requested URL;
  `/{cms_home_page}` → 301 `/`; Organization/WebSite JSON-LD on `/`. Save the full `venia-new-home` response as a
  fixture and check Page Builder coverage (list unsupported content types). Check: unit + integration tests.
- [x] T2 CMS override registry + `<CmsBlock>` (delegated writer; branch `feat/phase-2-02-cms-overrides` from `main`
  after PR #9 (T1) merged; typecheck, lint, test 620, test:integration 47, build green). Register an override in
  `src/modules/cms/ui/cms-page-overrides.ts` (`CMS_PAGE_OVERRIDES`, empty `Map`; component gets `{ page: CmsPage }`).
  `<CmsBlock identifier>` in `src/modules/cms/ui/cms-block.tsx`: missing/disabled/blank → nothing, Magento failure →
  reject. Notes for override authors: keep `<CmsBlock>` outside `<Suspense>` or a failure may ship as a 200; each
  block is one `cmsBlocks` call (batch later if a page uses several). Merged as PR #10. Follow-ups for the first
  real override (review advisories): prove `<CmsBlock>` failure → 5xx at HTTP level (current test renders
  in-process, not through Next's RSC renderer); assert the exact home canonical in
  `tests/unit/app/catch-all-cms-override.test.tsx`. Original scope: registry CMS identifier → Next page component, used by the catch-all
  `cms` branch (none registered → Magento content; Magento keeps metadata/404/redirects); cmsBlocks repository and
  `<CmsBlock identifier>` rendered with the Page Builder renderer. No home override component yet. Check: unit +
  integration tests (registered / not registered; block found / missing / Magento failure).
- [x] T3 Category domain + repository (delegated writer; branch `feat/phase-2-03-category-data`; typecheck, lint,
  test 675, test:integration 47, build green). T4 calls `getCategoryPage(uid, search)`
  (`src/modules/category/infrastructure/category-page.composition.ts`, per-request `cache()`) →
  `not_found` | `redirect` | `page` (category, listing of `ProductCard`, `indexable`, `canonicalPath`); rejects on
  Magento failure. `grid_per_page` added to store config (default 12). Product card mapping shared as
  `mapProductCard` in `product/infrastructure/magento-product-mapper.ts`. Choices to confirm: empty category with
  `?page=2` redirects; `?page=02` is invalid. T4 decides 307 vs 308 for invalid page.
  Verified 2026-10-14 against Magento (read-only GraphQL, run by the parent with the user's authorization):
  production and staging both expose `grid_per_page` (16), `category_url_suffix` (`.html`), `categoryList` by
  `category_uid` and `breadcrumbs.category_uid` (null on level-2 categories, parents listed below). Production's 10
  native categories have 0 products and no children today; staging
  (`https://staging.chupaprecios.com.mx/graphql`) has a tree (e.g. Cómputo 8 children, Herramientas 7, Audiovisual
  6) with assigned products (e.g. Herramientas 12, Herramienta manual 6). The out-of-range error on staging is the
  English text the repository matches (`currentPage value 99 specified is greater than the 1 page(s) available.`,
  `extensions.category: graphql-input`). Review fix: Magento refusing page 1 as out of range now rejects (5xx)
  instead of redirecting to itself in a loop. For T4 (review advisories): integration test of the composition
  (`gridPerPage` reaching the products query, per-request `cache()` shared by metadata and page).
  Original scope: category (name, description, breadcrumbs, meta, `url_path`) and products by
  `category_uid` with `currentPage` from `?page=N` and `pageSize` from `storeConfig.grid_per_page`; indexability rule
  (missing → 404, empty → 200 noindex, failure → 5xx). Check: unit RED→GREEN + MSW tests.
- [ ] T4 Category page: `category` branch in the catch-all (replaces today's 404), product grid, server-side
  pagination, empty state. Check: integration tests (exists / missing / empty / Magento failure / page out of range).
  Deviations (branch `feat/phase-2-04-category-page`): category head metadata (title, description, canonical,
  `index`/`noindex, follow`) moved here from T5, which keeps JSON-LD, breadcrumbs UI and menu links. Invalid or
  out-of-range `?page` answers 307 (`redirect()`). The Page Builder product card list was extracted to
  `page-builder/ui/product-cards.tsx` and reused by the category grid. Products named `-` are not filtered.
  Proving metadata and page share one resolution is done in `tests/integration/category.test.ts` (React `cache()`
  is a no-op outside a server request); the unit composition test proves `grid_per_page` 16 reaches `pageSize`.
- [ ] T5 Category SEO and links: metadata, canonical = clean URL without page, `CollectionPage`/`ItemList` +
  BreadcrumbList JSON-LD; every menu level to `categoryHref`; PDP breadcrumb JSON-LD `categoryUrl()` to category URLs
  (`product/ui/product-structured-data.ts:129`). Check: unit tests.
- [ ] T6 Ops and docs: phase 2 routing doc (category URLs and `/` to Next, prerender exclusion), env vars, phase 2
  report, e2e smoke. Check: `pnpm typecheck lint test test:integration build`.

## Delivery strategy

Same as phase 1: `ask-on-risk`, chain `stacked-to-main`; one PR per task slice.

## Progress

- 2026-10-13: discovery (read-only explorer) done; decision 1 asked. Full environment reference: `docs/environment.md`.
- 2026-10-13: decision 1 answered (CHAPI search result). Decision 2 asked.
- 2026-10-13: user corrected decision 1 and answered 2: categories = Magento data on `/{url_path}.html`, indexable,
  no CHAPI; CHAPI only for `/search.html`. Decision 8 asked. Draft tasks T1–T5 must be revised (T2 CHAPI adapter
  depends on decision 8; T3 needs category products from Magento).
- 2026-10-13: open item parked by the user: which local folder is the legacy PWA source of truth (candidates
  `chupaprecios-pwa`, `chupaprecios-pwa-next`, `chpwa-v1`, `pwa-studio`). Legacy-PWA claims above are unverified
  against it.
- 2026-10-14: user proposed decision 10 (Magento resolves `/`, per-page Next override registry, `<CmsBlock>`);
  verified `route("/")` and `venia-new-home` content against Magento; decisions 6, 7 and the home redirect taken;
  tasks rewritten (T1–T6). Engram mirror pending (hook error "Claude host session registration could not be
  confirmed").

## Next step

Decide on the T1 advisory findings, then T2 (CMS override registry + `<CmsBlock>`).

## Resume on another machine

1. `git fetch origin && git switch feat/phase-2-categories-home`
2. `pnpm install` (Node version in `.nvmrc`).
3. Create `.env.local` from `docs/environment.md` with real `MAGENTO_GRAPHQL_URL`, `CHAPI_BASE_URL`, `PUBLIC_BASE_URL`.
4. Check: `pnpm typecheck && pnpm lint && pnpm test`.
5. Read this file, then continue from "Next step".
