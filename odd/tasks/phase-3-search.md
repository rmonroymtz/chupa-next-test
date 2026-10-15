# Phase 3 storefront — search

Status: discovery done and all product decisions taken 2026-10-15; tasks finalized. No source code written yet.
Branch: `feat/phase-3-search` (from `main` at `88a8d23`, after phase 2 PRs #9–#14).

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
   `store=chupachoice`; no Magento search fallback. Magento `searchTerm.redirect` — DECIDED 2026-10-15: honored
   server-side, **sequentially**: query Magento `searchTerm` first; if it has a redirect, 307 to it and never call
   CHAPI; otherwise call CHAPI (user rule: CHAPI only for search and product pages; accepts ~0.75 s extra per search).
   Legacy reads
   it with a custom query `searchTerm(Search: $search, store: $store) { redirect }`
   (`chupaprecios-pwa/src/overrides/@magento/peregrine/lib/talons/SearchPage/searchPage.gql.js:39`,
   `useSearchPage.js:65-71`, client-side `window.location.replace`). Staging answers it
   (`taladro` → `redirect: null, popularity: 156`); one read was run 2026-10-15 — it may bump `popularity`.
9. Extras — DECIDED 2026-10-15: **in scope**: fallback-store notice (from the CHAPI response `vendor`, no extra call),
   GTM `SEARCH_REQUEST`/`SEARCH_RESPONSE` dataLayer events (follow the phase 1 cart dataLayer pattern in
   `src/modules/cart/domain/add-to-cart.ts:199-222`), recommendation sliders Crossell/Upsell/Recommender (Magento
   `randomProducts`, legacy `RandomSliders/**`). **Out of scope (later)**: header autocomplete.
10. Timeout and errors — DECIDED 2026-10-15: new env `CHAPI_SEARCH_TIMEOUT_MS` (default 8000); CHAPI failure or
    timeout → 200 page (`noindex`) with "No pudimos cargar los resultados" and a "Reintentar" link, plus a metric;
    Magento `searchTerm` failure → continue with the CHAPI search (no 5xx). Matches both upstream Venia and the
    Chupaprecios PWA, which never answer 5xx for search (upstream: Apollo RetryLink 5 attempts client-side only, no
    timeout, error shown as "No results found…"; Chupaprecios: SWR 3 retries, separate error and empty messages).

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
- [ ] T3 Search decision + route: parse `query`, `store` (default `chupachoice`; non-CHAPI or unknown → 307 to
  `chupachoice`), `page`, `storeParams`; bots → empty 200 without CHAPI; Magento `searchTerm` first → 307 when it has a
  redirect (failure → continue); CHAPI search (ChupaChoice: 4 parallel calls amazon 12, ebay 6, target 6, acme 6);
  `/search.html` served by Next; metadata title with the query, `noindex, follow`. Check: unit + integration.
- [ ] T4 Search UI: store tabs, results grid (reuse `ProductCards`), sort selector, filters (refinements), pagination
  from CHAPI links (`storeParams`, `page` display only), empty state, error state with "Reintentar", fallback-store
  notice, ChupaChoice multi-store view; desktop and mobile. Check: unit + integration + visual check on staging.
- [ ] T5 `*-search.html` SKU jump: do not trust Magento `route()` for `/{store}-{sku}-search.html` (placeholder
  product); resolve the product from CHAPI, render it on that URL with canonical = product canonical URL and `noindex`;
  bots → no CHAPI (phase 1 missing-product rule). Fixes the "Carmina Earrings" bug. Check: unit + integration.
- [ ] T6 Extras: GTM `SEARCH_REQUEST`/`SEARCH_RESPONSE` dataLayer events; recommendation sliders
  (Crossell/Upsell/Recommender from Magento `randomProducts`) under the results. Check: unit + integration.
- [ ] T7 Ops and docs: phase 3 routing doc (delete the temporary search rules 5 and 6 of phase 2; prerender
  exclusions), env vars, phase 3 report, e2e smoke for search. Check: full suite + build.

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
  returns `data.sorts: []`). Follow-ups for T3 (T2 review suggestions): an unusable responding vendor string should fall
  back to the requested store instead of making the page `invalid`; add a URL round-trip test for titles starting with
  a symbol (slug starting with `-`).

## Next step

Parent: review and commit T2, then T3 (search decision + route). The user still has to add `CHAPI_SEARCH_TIMEOUT_MS` to
`.env.example`.
