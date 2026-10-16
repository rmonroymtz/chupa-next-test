# Phase 3 storefront — search

Status (2026-10-16): **phase 3 complete pending the T7 PR.** T1–T6c merged to `main` (PRs #15–#23, last merge
`6fa689f`); T7 (ops and docs) committed on `feat/phase-3-07-ops-docs`, PR not opened yet. Go-live is the edge change in
`docs/routing/phase-3.md` (after phase 2's), see `docs/phase-3-report.md`.

## Resume here (2026-10-16, phase 4 hand-off)

1. Open the T7 PR from `feat/phase-3-07-ops-docs` (one work-unit commit: docs, e2e smoke, this file, the user's
   `.env.example` line). Tell the user to merge only after the last push. Then phase 3 is done.
2. Go-live (ops, not code): phase 2 edge change first, then `docs/routing/phase-3.md` (delete rules 5 and 6, remove
   prerender for search), `GTM_ID` in the task definition, run `E2E_BASE_URL=… E2E_PHASE3_SMOKE=1 pnpm test:e2e
   --project phase-3-smoke` against staging behind the edge.
3. Phase 4 starts from a new feature document (`odd/tasks/phase-4-….md`): the pages still on PWA are cart, checkout
   and account. Before planning, read `docs/phase-3-report.md` (differences from the legacy PWA, follow-ups) and pick
   which follow-ups below go into phase 4. Setup: `git fetch origin && pnpm install`; `.env.local` needs
   `MAGENTO_GRAPHQL_URL`, `CHAPI_BASE_URL`, `PUBLIC_BASE_URL`, optionally `GTM_ID`. Check: `pnpm typecheck && pnpm lint
   && pnpm test`, `pnpm test:integration`, `pnpm build`.

Open follow-ups (no decision needed now; all listed in `docs/phase-3-report.md`): acme base64url `-` SKU limitation
(count affected Magento SKUs before any format change); `useSearchParams` in the header without Suspense relies on every
route being dynamic; header integration assertions depend on HTML attribute order; prev link clamped to page 1 label;
search item slug keeps a trailing `-`; canonical with a literal `%` for missing products (phase 1); the product module
imports `buildSearchItemUrlKey` from `search/domain` (move it to the product domain); SEO slug gap (decision 11);
analytics dispatcher isolates only native Promise rejections (T6a review); cross-store `storeParams` pinning test (T6b
review); slider load promise created inline per render and untested rating cap (T6c review); stale
`.next/dev/types/validator.ts` (T6a, not reproduced since T6b). **New in T7 (needs a decision):** Magento placeholder
products render `index, follow` for non-vendor `/{x}-….html` urls (`/walmart-123456-search.html`,
`/walmart-123456-foo.html` → 200 "External URL Placeholder" on the dev server), because the placeholder check only
covers `PRODUCT_VENDORS`; reachable since phase 2 rule 9 (`*.html` → Next).

Working notes for the next session: the user writes in Spanish; commits use
`git -c user.name="Ricardo Monroy" -c user.email="ricardo@chupaprecios.com.mx"` (no git identity configured), no
`Co-Authored-By`; shell is zsh (pass provider tokens with `A=("${(@f)$(jq -r '…token' file)}")`); the user's dev
server usually runs on port 3000 against staging — don't kill it; agents cannot read or edit `.env*` (give the user the
lines); legacy behavior must be checked in `~/Proyectos/chupaprecios-pwa`, never assumed (two mistakes this phase came
from not checking: on-page store tabs, `searchTerm` redirects).

## Objective

Serve `/search.html?query=<q>&store=<store>&page=<n>` from the Next.js storefront using the CHAPI search API, so the
temporary PWA search rules in `docs/routing/phase-2.md` (rules 5 and 6) can be deleted.

## Problem / why

- Search is the last storefront page the edge still sends to PWA Studio for phase 1–2 routes; Next answers 404 for
  `/search.html` today.
- The header search form (`src/modules/layout/domain/search.ts`, `layout/ui/search-form.tsx`), the missing-product
  page (`product-page-service.ts:86,155,215-218`) and the WebSite JSON-LD `SearchAction`
  (`seo/domain/site-structured-data.ts:62-68`) all link to `/search.html`.

## Source of truth

Legacy behavior comes from `~/Proyectos/chupaprecios-pwa` (Chupaprecios fork, confirmed by the user 2026-10-15),
**not** `~/Proyectos/pwa-studio`. Phase 2 claims about the legacy home that came from `pwa-studio` are unverified.

## Constraints carried over

Same as phase 2 (`odd/tasks/phase-2-categories-home.md`): no Magento or API changes; no cross-request caching
(`force-dynamic`, `cache: 'no-store'`); Magento and CHAPI only from the server; bots never trigger CHAPI (phase 1
rule, enforced on the PDP in `product-page-service.ts:134,145`); all tunables zod-validated env vars; hexagonal
modules; stacked PRs to `main`, ~400 authored lines per slice (advisory).

## Discovery (2026-10-15, read-only explorer)

Legacy search (`chupaprecios-pwa`):
- `/search.html` is Magento page type `SEARCH` → `SearchPage` → talon `useSearchPage` (CHAPI via
  `useGetProductList`, sort via `@chupaprecios/sort-chapi`, `useEngineSettings`).
- Query params: `query`, `store` (page default `amazon`), `page` (display only, never sent to CHAPI),
  `storeParams` (opaque CHAPI link string carrying sort, filters and pagination; sent to CHAPI as `filters`).
- CHAPI stores: amazon, ebay, acme, target (`CHAPI_STORES_AVAILABLE`); others fall back to Magento `PRODUCT_SEARCH`.
  `store=chupachoice` renders a multi-store view (4 CHAPI calls: amazon 12, ebay 6, target 6, acme 6).
- Header tabs: chupachoice (default), amazon, ebay, target, acme; last pick kept in localStorage.
- Page size `storeConfig.grid_per_page` (16 on production and staging).
- CHAPI: `POST /api/v1/search/` (same-origin `/api` proxied to CHAPI), no auth, body
  `{ filters: storeParams || '', query, store: service_fallback[store], engine_id, page_size }`;
  `engine_id = engine_settings[service_fallback[store] + '_search_engine']`. Sort options from
  `POST /api/v1/search/sort_by` unless the search response has `data.sorts`.
- Response: `data.vendor`, `data.products[] {asin, title, brand, image.src, price{current_price, before_price},
  reviews.rating}`, `data.totalProducts`, `data.pagination {current, next, prev, totalPages, links[{title, link}]}`,
  `data.refinements[{title, type, links[{title, link, checked}]}]`, `data.sorts`. No OpenAPI or fixtures found.
- Card link: `/{vendor}-{encodedSku}-{slugified title}.html`.
- States: shimmer, network/server error, "No results found"; no client timeout (SWR retries 3).
- SEO: title "{store}'s Search Result for term {q}", no robots/noindex/canonical.
- `{store}-{sku}-search.html` is **not a results page**: the header builds it only when the query matches the
  store's SKU regex (amazon `^[A-Z0-9]{10}$`, ebay `^[0-9]{8,12}$`, target `^[0-9]+$`) and it renders the product page
  for that SKU. Next already parses it as a product URL.

Next (reusable / missing):
- `product/infrastructure/chapi-gateway.ts`: POST, timeout, metrics, never-reject result — product/variants only.
- Store config reads only `*_engine` and `service_fallback`; `*_search_engine` is missing and the mapper would map
  `amazon_search_engine` to key `amazon_search`. Needs a search engine resolver.
- `ProductCards` / `ProductCard` (phase 2) reusable; `CategoryPagination` (`?page=N`) does not fit CHAPI's opaque
  pagination links.
- robots.txt `Disallow: /*?*` already blocks every `/search.html?query=` URL.

## Open decisions (ask one at a time, in this order)

1. Scope of phase 3 — DECIDED 2026-10-15: **full parity with the PWA**: query, store tabs, pagination, sort
   (`/api/v1/search/sort_by` + selector), filters/facets (`refinements`) and the ChupaChoice multi-store view.
2. URL model — DECIDED 2026-10-15: keep the legacy model `?query&store&page&storeParams` (opaque CHAPI link sent as
   `filters`; `page` display only), so existing links keep working and no CHAPI link format is reverse-engineered.
3. ChupaChoice multi-store view — DECIDED with 1: in scope.
4. Default store — DECIDED 2026-10-15: `chupachoice` when `store` is missing (matches the header's default tab;
   differs from the legacy page default `amazon`).
5. Bots — DECIDED 2026-10-15: bots get a 200 search page without results and without any CHAPI call (header,
   title with the query, `noindex`), matching the phase 1 rule; link previews still show a coherent page.
6. Indexability — DECIDED 2026-10-15: `noindex, follow` on every search page (users and bots); robots.txt stays as is;
   the WebSite JSON-LD `SearchAction` stays.
7. `*-search.html` SKU jump — DECIDED 2026-10-15 (option 2, fastest: one request, no redirect): Next resolves
   `/{store}-{sku}-search.html` **without trusting Magento's route** (it returns a placeholder product) and renders the
   product from CHAPI on that same URL, with canonical = the product's canonical URL and `noindex`; bots get no CHAPI
   call (phase 1 rule). Measured on staging: CHAPI product ~0.35 s (response has `cache_hit`), Magento route ~0.75 s,
   Next product page ~1.0 s on the dev server; a 308 to the canonical URL would add a second request (~1.4 s+).
   **Bug found (2026-10-15, staging):** Next serves `/amazon-B00IJ0ALYS-search.html` as 200 "Carmina
   Earrings" (`index, follow`, self canonical). Cause: staging Magento `route(url: "amazon-B00IJ0ALYS-search.html")`
   returns `type: PRODUCT, sku: VA11-GO-NA, name: Carmina Earrings` (a placeholder product for every `*-search.html`);
   the legacy PWA ignores that and asks CHAPI, Next trusts Magento. CHAPI
   `POST /api/v1/product/ {sku: "B00IJ0ALYS", store: "amazon", engine_id: "direct"}` (staging, via `/api` proxy,
   gzip) returns the right product: `data.title` "DEWALT Kit de combo de perforación inalámbrico de 20V MAX…",
   `data.asin` B00IJ0ALYS, `data.price.current_price` 4434.6 MXN, `vendor` amazon. Staging engine settings:
   `amazon_engine` and `amazon_search_engine` both `direct`.
8. Non-CHAPI stores (homedepot, walmart, unknown values) — DECIDED 2026-10-15: 307 to the same search with
   `store=chupachoice`; no Magento search fallback. Magento `searchTerm.redirect` — **DROPPED (user, 2026-10-15)**,
   because the legacy PWA stopped calling it in commit `1189d821` (CHUP-569, 2024-10-21); the earlier "honor it"
   decision (Magento `searchTerm` first, 307 on a redirect, CHAPI otherwise) was based on reading dead code
   (`useSearchPage.js:65-71` declares the lazy query `searchTerm(Search: $search, store: $store) { redirect }` but never
   calls it). Searches go straight to CHAPI; no Magento call per search.
9. Extras — DECIDED 2026-10-15: **in scope**: fallback-store notice (from the CHAPI response `vendor`, no extra call),
   GTM `SEARCH_REQUEST`/`SEARCH_RESPONSE` dataLayer events (follow the phase 1 cart dataLayer pattern in
   `src/modules/cart/domain/add-to-cart.ts:199-222`), recommendation sliders Crossell/Upsell/Recommender (Magento
   `randomProducts`, legacy `RandomSliders/**`). **Out of scope (later)**: header autocomplete.
10. Timeout and errors — DECIDED 2026-10-15: new env `CHAPI_SEARCH_TIMEOUT_MS` (default 8000); CHAPI failure or
    timeout → 200 page (`noindex`) with "No pudimos cargar los resultados" and a "Reintentar" link, plus a metric;
    (the Magento `searchTerm` failure rule no longer applies: decision 8 dropped the call). Matches both upstream Venia and the
    Chupaprecios PWA, which never answer 5xx for search (upstream: Apollo RetryLink 5 attempts client-side only, no
    timeout, error shown as "No results found…"; Chupaprecios: SWR 3 retries, separate error and empty messages).

11. Search slug vs Magento url key — DECIDED 2026-10-16 (user): **follow-up, no change now**. The legacy PWA builds
    search card links with the same slug (`convertChapiToMagento.js:94`, non-ASCII → `-`; `Gallery/item.js:58`), and
    its PDP on CHAPI stores reads only `[store, sku]` from the path and asks CHAPI (slug and Magento `route()` ignored;
    no canonical, no robots meta, only `og:url`). Next keeps legacy parity (CHAPI render) plus `noindex` and the CHAPI
    canonical. Switching to the Magento slug would make Magento render those products (indexable): a new SEO behavior,
    not a parity fix. Note: legacy `generateUrlKey` (`product-full-details/src/helpers.js:182-189`) drops non-ASCII.
12. Analytics — DECIDED 2026-10-16 (user): Next loads no GTM today and only the cart pushes to `window.dataLayer`
    (private helper). New module `src/modules/analytics/` mirroring the legacy eventing pattern (components dispatch
    domain events; the `google-tag-manager` package maps them to dataLayer via `canHandle`/`handle` + `safePush`):
    domain events (typed), application `AnalyticsProvider` port + dispatcher fanning out to registered providers,
    `infrastructure/gtm` mappers + safe push, ui `<GtmScript>` (only when `GTM_ID` is set), client `<AnalyticsProvider>`
    with `useAnalytics().dispatch`, and `<TrackEvent>` for server pages. The cart moves to it (one push mechanism;
    legacy has two in parallel). Legacy search payloads: `{event:'search', search_term, store}` on the first search or a
    store change; `view_item_list` (`item_list_name 'Search Results'`, `item_list_id 'search_results'`) on every
    non-empty response; never for chupachoice. Legacy pushes `price: NaN` and empty `item_brand` (bug); Next sends the
    real price and brand. Sliders: `randomProducts(limit: 30, type: tendency|also_bought|recently)`, independent of the
    query, under single-store results only after a CHAPI answer, hidden when empty.

## Tasks

Route per task: delegated (writer trigger: 2+ non-trivial files). Test-first with Vitest + MSW. Forecast well over 400
authored lines in total: one stacked PR per task.

- [x] T1 Search config (staging fields verified; `searchEngineSettings` separate from `engineSettings`; `resolveSearchEngineId(store, routing)`; fixture has staging search engines; test 735, integration 56): `*_search_engine` in the store config query/mapper (without colliding with `*_engine`, e.g.
  `amazon_search_engine` must not become `amazon_search`), `resolveSearchEngineId(store)` using `service_fallback`,
  env `CHAPI_SEARCH_TIMEOUT_MS` (default 8000). Check: unit tests.
- [x] T2 (`src/modules/search/**`; `searchStore`/`getSearchSortOptions`; 6 staging search fixtures + 1 sort_by; test 779, integration 56) CHAPI search adapter: port + gateway for `POST /api/v1/search/` and `/api/v1/search/sort_by` (timeout,
  metrics, never-reject result, gzip), mapper to `ProductCard` (link `/{vendor}-{sku}-{slug}.html`), pagination links,
  refinements, sorts, response `vendor`; fixtures recorded from staging. Check: MSW unit tests (found, empty, timeout,
  error, invalid, items without price).
- [x] T3 (`src/app/search.html/page.tsx`; `resolveSearchPage`; test 822, integration 66; PR #17) Search decision + route: parse `query`, `store` (default `chupachoice`; non-CHAPI or unknown → 307 to
  `chupachoice`), `page`, `storeParams`; bots and empty query → 200 without CHAPI; no Magento `searchTerm` redirect
  (dropped, decision 8); CHAPI search (ChupaChoice: 4 parallel calls amazon 12, ebay 6, target 6, acme 6);
  `/search.html` served by Next; metadata title with the query, `noindex, follow`. Check: unit + integration.
- [x] T4 (search UI; PRs #18 and #19; test 874, integration 71) Search UI: results grid (reuse `ProductCards`), sort selector, filters (refinements), pagination
  from CHAPI links (`storeParams`, `page` display only), empty state, error state with "Reintentar", fallback-store
  notice, ChupaChoice multi-store view; desktop and mobile. Check: unit + integration + visual check on staging.
- [x] T5 (sku jump 44ad0f1; general placeholder fix + review fixes 90d7e4f; url-key hardening 7e801e0, PR #20 merged; test 927, integration 81) `*-search.html` SKU jump: do not trust Magento `route()` for `/{store}-{sku}-search.html` (placeholder
  product); resolve the product from CHAPI, render it on that URL with canonical = product canonical URL and `noindex`;
  bots → no CHAPI (phase 1 missing-product rule). Fixes the "Carmina Earrings" bug. Check: unit + integration.
- [x] T6a (route: delegated, writer trigger 2+ non-trivial files; `src/modules/analytics/**`, env `GTM_ID`, root layout, cart migrated; work-unit commit `feat(analytics): …`; test 951, integration 83; merged in PR #21 (`afe7c6f`); native review approved with one suggestion, R3-001: the dispatcher isolates only native Promise rejections) Analytics module + GTM loader (decision 12):
  `src/modules/analytics/**`, `<GtmScript>` in the root layout behind `GTM_ID`, `<AnalyticsProvider>`, migrate the
  cart add-to-cart event to it (same dataLayer payload). Check: unit + integration + build.
- [x] T6b (route: delegated, writer trigger 2+ non-trivial files; `search/application/search-analytics.ts`,
  `search/ui/search-requested-event.client.tsx`, `search/ui/search-page.tsx`, `analytics/ui/track-event.client.tsx`
  (`shouldTrack`); work-unit commit `feat(search): send the search and view_item_list analytics events`; test 983,
  integration 88; PR #22; native review approved with one warning, R3-001: a cross-store `storeParams` link
  would suppress the `search` event (no such in-app link today; a pinning test is a follow-up)) Search events:
  `search` and `view_item_list` via the analytics module from the search page (single store only, not bots/empty
  query), real price and brand. Check: unit + integration.
- [x] T6c (route: delegated, writer trigger 2+ non-trivial files; new module `src/modules/recommendations/**`,
  `search/ui/search-page.tsx` + `showsRecommendations`, `page-builder/ui/product-cards.tsx` (`showRating`), env
  `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS`, route; 3 recorded staging fixtures `tests/fixtures/magento/random-products.*`;
  work-unit commit `feat(search): show the recommendation sliders under the search results`; test 1019,
  integration 96; merged in PR #23 (`6fa689f`); native review approved with two suggestions: the slider load promise
  is created inline on every render, and the rating cap is untested) Recommendation sliders (Crossell/Upsell/Recommender) from Magento `randomProducts` under
  single-store results; recorded staging fixture. Check: unit + integration.
- [x] T7 (route: delegated, writer trigger 2+ non-trivial files; `docs/routing/phase-3.md`, `docs/phase-3-report.md`,
  `docs/environment.md`, `docs/deploy/ecs-fargate.md`, `docs/routing/phase-2.md` link, `e2e/phase-3-smoke.spec.ts`,
  `playwright.config.ts`; work-unit commit `docs: add the phase 3 routing doc, report, env vars and search smoke`;
  test 1019, integration 96, e2e smoke 6 passed against the dev server) Ops and docs: phase 3 routing doc (delete the
  temporary search rules 5 and 6 of phase 2; prerender exclusions), env vars, phase 3 report, e2e smoke for search.
  Check: full suite + build.

## Delivery strategy

Same as phase 2: `ask-on-risk`, chain `stacked-to-main`; one PR per task slice.

## Progress

- 2026-10-15: legacy PWA source of truth confirmed (`~/Proyectos/chupaprecios-pwa`); discovery done; decision 1 asked.
- 2026-10-15: decision 1 = full parity (sort, filters, ChupaChoice included); decision 3 resolved by it. Decision 2
  asked.
- 2026-10-15: decision 2 = legacy `storeParams` URL model. Decision 4 = `chupachoice` default. Decision 5 = bots get an empty
  200 page, no CHAPI. Decision 6 = `noindex, follow`. Decision 7 asked; `*-search.html`
  placeholder-product bug found and diagnosed against staging Magento and CHAPI. Decision 7 = render the CHAPI
  product on the `-search.html` URL (canonical to the product, `noindex`). Decision 8 (stores) = 307 to
  `chupachoice`; search term redirects = Magento first, CHAPI only without redirect. Decision 9 = notice + GTM +
  sliders in, autocomplete out. Decision 10 = own 8 s timeout, 200 error page with retry. All decisions taken;
  tasks T1–T7 finalized.
- 2026-10-15: T1 implemented (delegated writer, uncommitted). Staging schema verified with one read-only query: all six
  `{acme,amazon,ebay,homedepot,target,walmart}_search_engine` fields exist (staging: direct, direct, api, bigbox,
  direct, direct). Domain `EngineRouting.searchEngineSettings` is a separate map from `engineSettings`;
  `resolveSearchEngineId(store, routing)` returns null for no fallback / no search engine (callers decide). Env
  `CHAPI_SEARCH_TIMEOUT_MS` (default 8000) documented in `docs/environment.md`; `.env.example` still needs the
  same three lines (user edit). RED: 14 failed / 29 passed in 4 store-config + env test files; GREEN: 43 passed.
  Checks: typecheck, lint, unit (735), integration (56), build all pass; dev server 200 on `/`.

- 2026-10-15: T2 implemented (delegated writer, uncommitted, branch `feat/phase-3-02-chapi-search`). Staging recorded
  read-only through the PWA `/api` proxy (gzip; Node `fetch` decompresses it). Observed vs discovery: envelope also has
  `cache_hit`, `error`, `search_time`, `debug_html`, `data.engine`; `pagination.totalPages` is **absent** (only
  `current`, `next`, `prev`, `links`); `links` omit the current page; `data.sorts` is `[]` on every staging response,
  so `sort_by` is always needed; `sort_by` answers `data: [{title, link, selected}]` (an array); amazon
  `totalProducts` is the page's item count (16), eBay's is the search total (1,020,781); empty search is
  `status: "no_results"` with empty lists; eBay `stock_status` is `unknown`; `brand` is `""` on every item; checked
  refinement options carry the link that removes them. Mapper skips items without sku, title or positive current price
  (counted, `ChapiSearchSkippedItems` metric) and repeated skus. RED: 4 test files failed at import; GREEN: 44 search
  tests. Checks: typecheck, lint, unit (779), integration (56), build pass.
- 2026-10-15: T1 review advisory (shared storeConfig query) checked against **production** Magento: all six
  `*_search_engine` fields exist there too (homedepot `direct` in production, `bigbox` on staging; both fall back to
  amazon via `service_fallback`).

- 2026-10-15: T2 review fixes: body-read failure after a 2xx → `error` (not `invalid`) for search and sort_by;
  `duplicateItems` counted apart from `skippedItems` (only the latter alerts); card links only use a vendor in
  `PRODUCT_VENDORS` (responding vendor → requested store → skip). **Known limitation confirmed (pre-existing, also in
  legacy and phase 1 product URLs):** an acme SKU whose base64url contains `-` (e.g. `~~~` → `fn5-`) is read back by
  `parseProductUrl` as a different SKU (`~~`); documented by a test, URL format unchanged, decision pending.
  Unit 785.

- 2026-10-15: decision (user): sort options are requested **after** the search, only when the search response has
  no `data.sorts` (legacy behavior, already how T2 `getSearchSortOptions` works); the selector streams in its own
  Suspense boundary so results never wait for it (~2 s later than results with today's staging CHAPI, which always
  returns `data.sorts: []`). Unusable responding vendor strings now fall back to the requested store (fixed in T2 after review).
  Follow-up for T3: add a URL round-trip test for titles starting with
  a symbol (slug starting with `-`).

- 2026-10-15: T3 implemented (delegated writer, uncommitted, branch `feat/phase-3-03-search-route`). Route: static
  `src/app/search.html/page.tsx` (wins over the catch-all, no Magento `route()` call). Pure
  `resolveSearchPage({ search, userAgent }, deps)` → `redirect` (`unknown_store`) or `page`
  `{ query, store, page, storeParams, results }` with `results` `none` (`empty_query` | `bot`) | `single` (one
  `StoreListing`) | `multi` (4 listings); `StoreListing = { store, pageSize, filters, result | null, failure | null,
  servedByFallback }` (T4 renders it and calls `getSearchSortOptions` with the listing's store/filters/pageSize).
  Single-store page size = `grid_per_page` (fallback 12). Metric `SearchPage`
  (Outcome). Metadata: `Búsqueda: {q}`, `noindex, follow`, no canonical. T2 follow-ups: slug round-trip tests
  (leading symbol, no ASCII alphanumerics, empty title) pass with the legacy slug unchanged (no fix needed: the
  parser reads only the vendor and sku segments); `sortOptions` never rejects on store config failure (store-search +
  composition tests). RED: 4 new unit files failed at import; follow-up and integration tests were green on first
  run. Checks: typecheck, lint, unit (852), integration (69), build pass; dev server (staging): amazon 200, 16 cards,
  `noindex, follow`; chupachoice 4 sections, 30 cards; walmart 307 to chupachoice.
- 2026-10-15: the writer found the legacy PWA no longer calls `searchTerm` (CHUP-569); user decision: drop it. Removed
  the searchTerm step, port, Magento repository, redirect-target validator (`searchRedirectLocation`), the
  `search_term` redirect reason and `redirect_search_term` metric outcome, their tests and the integration mock/case.
  Added one unit assertion per remaining `SearchPage` Outcome (`redirect_unknown_store`, `empty_query`, `bot`,
  `results`, `failure`; a ChupaChoice view with one failed list counts as `failure`); integration asserts no Magento
  call besides `StoreConfig`/`HeaderMenu`. RED: typecheck failed on the new deps shape (the old step swallowed the
  missing dep at runtime, so unit tests were already green); GREEN after the removal. Checks: typecheck, lint, unit
  (822), integration (66), build pass; dev server (staging): amazon 200, 12 cards (staging returned fewer usable
  items than the earlier run's 16), `noindex, follow`; chupachoice 4 sections, 30 cards; walmart 307.

- 2026-10-15: T4 implemented (delegated writer, uncommitted, branch `feat/phase-3-04-search-ui`). Pure link helper
  `search/domain/search-links.ts` (pagination → `page=<title>&storeParams=<link>`, sort/refinement → `page=1&storeParams`,
  tab → `query,store,page=1`, "Limpiar filtros" → no `storeParams`); pagination model
  `search/domain/search-pagination.ts` (url `page` wins over CHAPI `current`; current page inserted among CHAPI links;
  prev/next labeled current∓1). UI: store tabs (`aria-current`), sort `<details>` menu of links streamed in its own
  `<Suspense>` via an injected `loadSortOptions` (route passes `getSearchSortOptions`; failures → no options; legacy
  alphabetical order, `price`/`position` links dropped), refinements sidebar (lg) + `<details>` copy below lg, 5 options
  per group then "Mostrar más" (opened when a hidden option is checked), CHAPI pagination, fallback notice (legacy
  `BackupStoreMessage` copy), ChupaChoice view ("Resultados por tienda", "Ver más en {Tienda}" when a store has items).
  Count line: "{n} productos en esta página" (items shown), never `totalProducts` (amazon = page count, eBay = whole
  search). Header search bar reflects `/search.html` store and query via a small client component
  (`usePathname`/`useSearchParams`, SSR-rendered because every route is dynamic); **no Suspense around it**: React
  outlines boundaries > 500 bytes or with images, which sent the default state first and needed JS to swap. RED: 2 new
  unit files failed at import, view test 9 failed / 8 passed, layout 4 failed; GREEN after implementation. Integration
  (+5) green on the first run except one regex on attribute order. Checks: typecheck, lint, unit (859), integration
  (71), build pass; staging screenshots (amazon 1366/390, sort, filter, page 2, ChupaChoice) look right. Known visual
  nit: ChupaChoice lists of 6/12 in the 5-column grid leave orphan rows.

- 2026-10-15: user reported the on-page store tabs (`SearchStoreTabs`) as a visual error: the Chupaprecios PWA search
  page has none (store switching lives only in the header search bar, which T4 makes reflect the current store and
  query). The parent had asked for them in the T4 brief without checking the legacy. Removed; tests now assert no
  `nav[aria-label="Tiendas"]` on single-store and ChupaChoice pages. "Store tabs" in decision 1 means the header
  search bar tabs. Unit 859, integration 71.

- 2026-10-15: decision (user, T4 review warning): when CHAPI answers with another vendor (`servedByFallback`), the
  pagination, filter and sort links and the `sort_by` call use **the store that answered** (when it is a search store),
  not the requested one, so its opaque CHAPI links are never sent to a different store. Differs from the legacy PWA,
  which kept the requested store. The header search bar then follows that store after a click. When the answering vendor is
  not a search store, the page shows products only (no filters, sort or pagination links). Repeated non-numeric page
  titles are kept once and list keys are index-prefixed; the legacy `price`/`position` sort links are dropped (now
  tested). Unit 863, integration 71.

- 2026-10-15: user asked the ChupaChoice view to look exactly like the PWA (`chupachoice` `ChupaChoice` +
  `ProductList`). New `src/modules/search/ui/chupachoice-section.tsx` (search-only; `ProductCards` untouched): legacy
  title (uppercase, light/bold 20px, line-height 90px) in `container-padded`, section `mb-12`, the store logo as the
  `h2` (legacy rendered sizes: amazon 80x24, ebay 60x24, target 148x32, acme 131x48), "Ver MÁS productos" link
  (orange, 20px light / 42px bold, legacy chevron) to `storeTabHref`, grid 2 → 3 (≥768px) → 6 (≥1280px) columns with
  the legacy gaps, bordered item (image 194/172, stars, 90-char name, "Promoción N%" + "Precio final $1,234.56"), and
  the legacy no-results box ("Esta tienda no tiene ninguna coincidencia" / "No pudimos consultar esta tienda en este
  momento" + "Búsqueda: {query}"). Amazon/eBay/Target reuse the header logos (identical SVG paths); Acme uses the
  legacy square `AcmeLogo`, added as `public/images/search/stores/acme.svg`. Kept a "Reintentar" link in the error
  box (not in the legacy). Roboto Flex is already the base font. Unit 867, integration 71, build pass.

- 2026-10-16: T6a implemented (delegated writer, branch `feat/phase-3-06-search-extras`). Module
  `src/modules/analytics/`: domain `AnalyticsEvent` union (`ProductAddedToCart` {sku, name, unitPrice, quantity},
  `SearchRequested` {query, store}, `SearchResultsViewed` {query, store, items {sku, name, price|null, brand|null,
  index 1-based}}); application `AnalyticsProvider` port + `createAnalyticsDispatcher` (fan-out in order; a throwing or
  rejecting provider goes to `onError` and never reaches the caller or the next providers); `infrastructure/gtm`
  `toDataLayerObject` (add_to_cart identical to the old cart payload; `search`; `view_item_list` with the real price,
  `0`/`''` for null price/brand, null for an empty list), `pushToDataLayer` (no-op server-side or without
  `window.dataLayer`, try/catch), `gtmAnalyticsProvider`, snippet builders, `getGtmContainerId` (server-only); ui
  `<GtmScript>` (inline standard GTM snippet + noscript iframe, first in `<body>` so `dataLayer` exists before
  hydration; nothing without `GTM_ID`), client `<AnalyticsProvider>`/`useAnalytics()` (context defaults to the GTM
  dispatcher; optional `dispatcher` prop for tests) wrapping header/main/footer in the root layout, and `<TrackEvent>`
  (dispatches once per mount, StrictMode-safe; T6b should key it by query/store). Env `GTM_ID` (optional, strict
  `^GTM-[A-Z0-9]+$` because it is inlined in a script). Cart: `buildAddToCartDataLayerEvent` replaced by
  `buildProductAddedToCartEvent` (null without a price, same as before); `add-to-cart.client.tsx` dispatches it through
  `useAnalytics()`, private `pushDataLayer` removed; the cart UI test now asserts the exact pushed payload. No CSP in
  the app (no middleware/proxy, no `headers()` in `next.config.ts`), so nothing to allow. `.env.example` and
  `docs/environment.md` still need `GTM_ID` (user edit / T7). RED: 8 unit files failed (6 at import), 4 tests failed
  (env GTM_ID, cart event builder); GREEN: 162 focused tests. Integration `tests/integration/analytics.test.ts` (+2,
  two servers from one build, `GTM_ID` unset vs set) green on the first run (not run against the base build). Checks:
  typecheck, lint (0 errors, 1 pre-existing warning), unit (951), integration (83), build pass — with the stale
  dev-server types `.next/dev/types` (2026-10-13, reference removed routes `[...path]`, `page`) moved aside during the
  checks and restored afterwards; with them in place `pnpm typecheck` and `pnpm build` fail on those files only.

- 2026-10-16: T6b implemented (delegated writer, branch `feat/phase-3-06b-search-events`). Application
  `searchPageEvents(view)` (`search/application/search-analytics.ts`, depends on the analytics domain events only):
  single-store pages only (nothing for ChupaChoice, bots, blank query); `requested` = `SearchRequested` {query,
  requested store} keyed `${store}:${query}`, also for a failed or empty search; `resultsViewed` =
  `SearchResultsViewed` only for a non-empty answer, keyed by `[store, query, page, storeParams]`, items in the
  rendered order (sku, name, `getDisplayPrice` amount = the card price or null, brand or null, 1-based index), store =
  `result.vendor` when `servedByFallback` (the store the fallback notice names), else the requested store.
  `<SearchPage>` stays a server component and renders two islands with serializable props: `<SearchRequestedEvent>`
  (search ui client, wraps `<TrackEvent shouldTrack>`) and `<TrackEvent>`. **Navigation finding:** every search
  navigation is a full document load (plain `<a>` pagination/sort/filter links, GET search form; no `next/link`), so
  the islands mount on every page and React keys cannot dedupe (keys only matter for an in-place re-render; kept for
  that case and verified by a TrackEvent unit test). The search event is therefore skipped in the browser when
  `isSameSearchNavigation(document.referrer, location)`: same-origin `/search.html` referrer with the same trimmed
  query and the same store, or any CHAPI link (`storeParams`, covers fallback links that carry the answering store).
  Store tabs, "Ver MÁS productos", a new query, another site or no referrer → reported. Limits: a reload of a
  refinement page or a repeated search-bar submit of the same pair is not reported (legacy SPA also did not on
  in-page changes); a stripped referrer over-reports. `TrackEvent` gains optional `shouldTrack` (asked once on mount,
  StrictMode-safe); GTM payloads unchanged. RED: 2 new test files failed at import, 5 tests failed (TrackEvent
  `shouldTrack`, view islands); GREEN: 187 focused tests. Integration `search.test.ts` (+5): parses the inlined RSC
  flight data for the TrackEvent props (results: search + list with the recorded first item's ASIN, price 1082.88,
  brand null; failure/empty: search only; ChupaChoice, blank query, bot: none); green on the first run (not run
  against the base build). Checks: typecheck, lint (0 errors, 1 pre-existing warning), unit (983), integration (88),
  build pass, with `.next/dev/types` in place (it no longer breaks typecheck or build).

- 2026-10-16: T6c implemented (delegated writer, branch `feat/phase-3-06c-search-sliders`, stacked on T6b).
  Staging evidence (parent, read-only GraphQL): `ProductCarouselType` = recommended, tendency, also_bought, recently;
  `randomProducts(limit: 30)` answered 16/16/15 products (tendency/also_bought/recently), all `store: "amazon"`, no
  null fields, `regular_price: 0` without a discount (5–6 per list higher than `price`), `link` = url key + `.html`
  without a leading slash, images on `m.media-amazon.com`; recorded as `tests/fixtures/magento/random-products.{tendency,
  also-bought,recently}.json` (pretty-printed, nothing trimmed). Design: new screaming module
  `src/modules/recommendations/` (domain `RecommendedProduct` = `ProductCard` + `rating`, `RECOMMENDATION_TYPES`,
  limit 30; application port + `loadRecommendations` (never rejects, warn `recommendations unavailable`);
  infrastructure `GetRandomProducts` query (no keywords/order), mapper (relative url = link without leading slashes,
  url key = link minus `.html`, uid `{store}-{sku}`, price copied with the regular price only when higher, MXN from
  `MAGENTO_CURRENCY`, rating only > 0, skips items without sku/name/link/positive price and repeated skus), repository
  with its own timeout, composition `getRecommendations` (React `cache()` per request only: the phase constraint forbids
  cross-request caching, same as the header menu and store config); ui `<RecommendationSliders>`). Not a product
  submodule: recommendations are their own capability (Magento carousels), reusable outside search. Rendering:
  `showsRecommendations(view)` = single store whose search answered (also 0 items and fallback answers); never a
  failed search, ChupaChoice, bots or a blank query (no Magento call for those). `<SearchPage>` takes an optional
  `loadRecommendations` (the route passes `getRecommendations`); the three loads start in the same render (parallel),
  each slider streams in its own Suspense boundary after the results (legacy title + accent and 5 skeleton cards
  meanwhile) and renders nothing when empty or failed. Cards reuse `ProductCards` carousel (CSS scroll-snap, no client
  JS) with a new `showRating` prop: legacy stars (grey row + amber row clipped to the rating, `role="img"`, "Calificación:
  4.4 de 5 estrellas"); off for CMS and search grids. Struck regular price via the existing `ProductPrice`. Images:
  `m.media-amazon.com` is already a default `IMAGE_REMOTE_HOSTS` entry, so `next/image` optimizes them (verified in the
  integration html); `next.config.ts` unchanged. Timeout: new optional env `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS`
  (module default 3000 ms when unset; optional instead of a schema default because `tests/unit/shared/config/env.test.ts`
  pins the full defaults object and was outside the edit surface) — T7 must add it to `.env.example`,
  `docs/environment.md` and `docs/deploy/ecs-fargate.md`. Magento failures are logged and metered by the client
  (`MagentoError`, Operation `GetRandomProducts`) plus the module warn. Mock Magento: `GetRandomProducts` by `type`
  (`randomProducts` config + `setRandomProducts`), unset → HTTP 400 like any unknown operation (sliders hidden), so other
  suites are unchanged. Integration helpers: `cardLinks` now reads only the html before the sliders; `otherMagentoCalls`
  ignores `GetRandomProducts` (asserted with `sliderCalls`); slider assertions read only the `<section>` opening tags
  and all links after the results, because React outlines parts of a large streamed boundary (`<template id="P:…">`)
  and a slider's cards are not always inside its section in the raw html (found when the first per-section assertion
  failed). RED: 4 new unit files failed at import, 8 tests failed (ProductCards rating, search page sliders); GREEN:
  focused 423. Integration (+8): sliders with the recorded links and titles for a single-store result and for 0
  items; none and no Magento call for a failed search, ChupaChoice, a blank query and a bot; one slider 503 + one
  slower than the timeout → only the third slider, page 200 with its results; all failing → no sliders; not run against
  the base build. Checks: typecheck, lint (0 errors, 1 pre-existing warning), unit (1019), integration (96), build
  pass, with `.next/dev` in place.

- 2026-10-16: T7 implemented (delegated writer, branch `feat/phase-3-07-ops-docs`). `docs/routing/phase-3.md`: with
  the phase 2 rules live, phase 3 only deletes rules 5 (`/search.html` → PWA) and 6 (`*-search.html` → PWA); both
  urls then match rule 9 (`*.html`) or the product rule 8, so the only `.html` ordering constraint left is Magento
  paths (rule 7) above `*.html`; a short variant for an edge still on phase 1 only; prerender removed for both (no
  `.html` url goes to prerender any more; a prerender renderer would bypass the bot rule and call CHAPI); no caching
  (content and status depend on the UA); rollback = add both PWA rules back above `*.html`; checklist with curl and the
  smoke. Phase 2's "Next step" links to it. Env docs: `GTM_ID` and `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS` added to
  `docs/environment.md` (`CHAPI_SEARCH_TIMEOUT_MS` was already there), all three added to the ECS table, plus the e2e
  variables `E2E_PHASE3_SMOKE`, `E2E_SEARCH_QUERY`, `E2E_SKU_SEARCH_PATH`. `e2e/phase-3-smoke.spec.ts` (project
  `phase-3-smoke`, only with `E2E_BASE_URL` and `E2E_PHASE3_SMOKE=1`): amazon results with `Vary: rsc` and `noindex,
  follow`, ChupaChoice 4 sections in order, walmart 307, blank query, sku jump canonical prefix, Googlebot 200 without
  results and 404 on `*-search.html`; 6 passed against the dev server; `pnpm test:e2e --list` without the variables lists
  only `local` and `pwa-checkout`. Dev server findings: Magento there answers the production placeholder
  ("External URL Placeholder") for non-vendor urls (`/walmart-123456-search.html`, `/walmart-123456-foo.html`) with
  200 `index, follow` (follow-up above); the Next header search bar never builds `*-search.html` (legacy SKU jump not
  replicated; documented). Checks: typecheck, lint (0 errors, 1 pre-existing warning), unit (1019), integration (96),
  build pass; `pnpm format:check` fails only on pre-existing `docs/phase-1-report.md` and
  `tests/fixtures/page-builder/venia-new-home.json` (changed files pass `prettier --check`). `.env.example`: the user
  staged `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS`; `GTM_ID` (if missing) and the three e2e lines are the user's edit.

## Next step

See "Resume here" at the top of this file. Entries below are the detailed T5 log.

- 2026-10-15: decision (user): the acme base64url `-` SKU limitation (e.g. `~~~` → `fn5-`, read back as `~~`) stays
  as is for now — inherited from the legacy PWA and phase 1 product URLs. Follow-up before any format change: count how
  many real acme SKUs in Magento produce a `-` in their base64url encoding; only change the encoding (with redirects
  for old URLs and coordination with the PWA) if that number justifies it.

- 2026-10-15: T5 implemented (delegated writer, uncommitted, branch `feat/phase-3-05-sku-search`). Pattern
  `matchSkuSearchUrl` (`product/domain/product-url.ts`): after decoding the path once, the url key splits on `-` into
  exactly `[vendor in PRODUCT_VENDORS (case-insensitive), sku segment (may be empty), "search" (lowercase)]` + `.html`;
  `-SEARCH.html`, `{vendor}-{sku}-best-search.html`, unknown vendors and nested paths keep the normal Magento flow.
  The service checks it **before** Magento `route()` (never called for the pattern) and reuses the phase 1 missing
  product branch: bots → `not_found`/`missing_bot` (404, no Magento, no CHAPI, no mutation); users →
  `missing_product` with new field `origin: 'sku_search'` (phase 1 urls: `origin: 'product_url'`), lookup from
  `parseProductUrl` (eBay `?var=`, acme base64url), `searchUrl` `/search.html?query={sku}&store={vendor}` (no `query`
  for an empty sku). Canonical: `generateMetadata` awaits the scraper lookup (React `cache()`d per request, shared
  with the streamed `ScrapedProductSection`: one CHAPI call) and points to `/{vendor}-{chapi asin}-{slug}.html` built
  with the search item builder (`buildSearchItemUrlKey`); CHAPI miss/failure or a title without ascii letters/digits
  → the `-search.html` url itself. Because `htmlLimitedBots: /.*/`, the head of a sku search page waits for CHAPI
  (bounded by `CHAPI_TIMEOUT_MS`); Magento `route()` (~0.75 s) is skipped instead. Copy mutation (`processSku`) fires
  after a found product, same as phase 1 (idempotent by sku, as for every scraped page view). No product JSON-LD.
  CHAPI miss/failure → 200 `noindex, follow` "Producto no disponible". RED: unit 28 failed (matcher/service), integration
  4 failed against base src (`index, follow` Carmina placeholder; bot got 200); GREEN. Checks: typecheck, lint, unit
  (905), integration (75), build pass. Dev server (staging): `/amazon-B00IJ0ALYS-search.html` 200, DEWALT, no Carmina,
  `noindex, follow`, canonical `…/amazon-B00IJ0ALYS-dewalt-kit-de-combo-de-perforaci-n-inal-mbrico-de-20v-max-2-herramienta-dck240c2-.html`,
  ~1.0 s warm; Googlebot → 404 `noindex`; `/search.html?query=taladro&store=amazon` 200 `noindex, follow`.
  **New finding (resolved below, same day):** staging Magento `route()` answers the same Carmina placeholder (`VA11-GO-NA`) for **every**
  unknown vendor product url (e.g. `/amazon-B0ZZZZZZZZ-foo.html`, `/ebay-1-foo.html`, and the canonical url above);
  `/no-existe-xyz.html` is a 404. So on staging the phase 1 missing-product flow never runs and the T5 canonical url
  renders Carmina `index, follow`. Not fixed in T5 (outside its scope): needs a decision (check production; detect the
  placeholder by sku/url mismatch like the legacy PWA does?).

- 2026-10-15: T5 general fix (user approved, same branch). Production evidence (parent, read-only GraphQL): Magento
  `route()` answers a placeholder PRODUCT for **any** vendor-shaped url it does not have — production
  `sku: urllocator-external-placeholder, name: External URL Placeholder`, staging `sku: VA11-GO-NA, name: Carmina
  Earrings` (`amazon-B0ZZZZZZZZ-foo.html`, `ebay-1-foo.html`, `amazon-B00IJ0ALYS-search.html`); `no-existe-xyz.html`
  → `route: null`; a real vendor product answers its own sku. Production serves these urls from the PWA today, so no
  live impact yet. Fix (phase 1 service): when Magento answers a PRODUCT for a vendor product url (vendor in
  `PRODUCT_VENDORS`, suffix, no `/`) and `matchesProductUrlSku` is false, the product is ignored and the phase 1
  missing-product flow runs (bots 404 without CHAPI; users CHAPI, `noindex`); metric `MagentoPlaceholderIgnored` + log
  `magento placeholder ignored` (`magentoSku`, `magentoUrl`). Never matches on placeholder names or skus. Match rule:
  normalized, case-insensitive Magento sku equals the decoded join of the first 1..n url key segments after the vendor
  (covers skus with `-` and acme base64url encodings with `-`, e.g. `~~~` → `fn5-`), or its eBay `?var=` form. Urls
  that are not vendor product urls keep trusting Magento. Review fixes: R3-double-decode — the service now passes
  the raw pathname to `matchSkuSearchUrl`/`parseProductUrl`/`matchesProductUrlSku` (each decodes once); before, the
  already-decoded route url was decoded again (also in the phase 1 missing branch), so `A%25B` lost its sku;
  R3-sku-hyphen-fallthrough — `/amazon-ABC-123-search.html` stays **out** of the sku jump because `parseProductUrl`
  reads only `ABC` (legacy split) and would not round-trip `ABC-123`; the legacy header never builds such urls (ASIN,
  eBay and Target regexes have no `-`); it goes through Magento, whose placeholder is now ignored (missing flow,
  lookup `ABC`, legacy parity); R3-canonical-to-placeholder — integration asserts the canonical url of a found sku
  search page renders the CHAPI product as a missing product, never the placeholder; suggestion — integration for a
  slow CHAPI on a `-search.html` url (`CHAPI_TIMEOUT_MS` 1 s): 200, self canonical, `noindex`, unavailable. RED: unit
  12 failed; integration 3 failed against 44ad0f1 (placeholder `index, follow`, bot 200; the timeout test was green
  already, coverage only); GREEN. Checks: typecheck, lint, unit (921), integration (79), build pass. Dev server
  (staging): `/amazon-B0ZZZZZZZZ-foo.html` user 200 `noindex, follow` "Producto no disponible", no Carmina; Googlebot
  404; the DeWalt canonical url 200 DEWALT from CHAPI, `noindex, follow`, self canonical (staging Magento has no
  product at that url: its answer was a placeholder or null); `/amazon-B00IJ0ALYS-search.html` 200 DEWALT `noindex`;
  search page 200. **Open:** the staging Magento DeWalt copy (sku `B00IJ0ALYS`) lives at a url key other than the slug
  built from the current CHAPI title, so the sku jump canonical points to a `noindex` missing-product url instead of the
  indexable Magento page (assumption, not verified: the url key was built from an older or different title).

- 2026-10-15: T5 hardening (review WARNING R3-placeholder-false-positive-bot-404 on 90d7e4f: the sku-only rule could
  downgrade a real Magento product whose url does not carry its sku; RED confirmed it: user `noindex`, bot 404).
  Evidence (parent, read-only GraphQL): production placeholder `relative_url` = requested path, `url_key: null`,
  `url_suffix: .html`, `sku: urllocator-external-placeholder`; staging placeholder `url_key: carmina-earrings`,
  `sku: VA11-GO-NA`; both `uid: MQ==`. Real DeWalt (both envs): `sku: B00IJ0ALYS`, `url_key`
  `amazon-B00IJ0ALYS-dewalt-kit-de-combo-de-perforacin-inalmbrico-de-20v-max-2-herramienta-dck240c2`, `url_suffix: .html`
  (url key + suffix equals the requested path case-insensitively). Renamed keys answer `redirect_code` > 0, not a
  product. **Rule (conservative):** Magento's product for a vendor product url is ignored as a placeholder only when
  BOTH (a) its `url_key + url_suffix` (suffix falls back to the configured `.html`; an empty url key never matches) is
  not the requested url key path, case-insensitively, path decoded once, AND (b) its sku is not in the url
  (`matchesProductUrlSku`). No `uid`, placeholder names or placeholder skus are used. `url_key`/`url_suffix` were
  already selected by `ProductByRoute`; the mapper now keeps `url_suffix` as optional `MagentoProduct.urlSuffix`.
  Integration placeholder mocks now mirror the evidence (staging `url_key: carmina-earrings`, production `url_key:
  null`); new integration case: a Magento product whose sku is not in its url but whose url key matches stays 200
  `index, follow` with Product JSON-LD for users and bots, no CHAPI. RED: unit 2 failed (mapper suffix, url-key match),
  integration 2 failed against 90d7e4f; GREEN. Checks: typecheck, lint, unit (927), integration (81), build pass. Dev
  server (staging): `/amazon-B0ZZZZZZZZ-foo.html` user 200 `noindex` unavailable, no Carmina; Googlebot 404; the real
  DeWalt url `/amazon-b00ij0alys-…-dck240c2.html` user and Googlebot 200 `index, follow`, Product JSON-LD, Magento
  title; `/amazon-B00IJ0ALYS-search.html` 200 DEWALT `noindex`; search page 200. **Open (explains the earlier
  DeWalt canonical question):** the sku jump canonical uses the legacy search slug (non-ascii → `-`, e.g.
  `perforaci-n-inal-mbrico-…-dck240c2-`), while Magento url keys drop non-ascii characters (`perforacin-inalmbrico-…-
  dck240c2`), so for a product Magento already has, the canonical points to a `noindex` missing-product url, not the
  indexable Magento page. Search result card links share the same slug.
