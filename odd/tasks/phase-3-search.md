# Phase 3 storefront — search

Status (2026-10-15, end of day): T1–T4 merged to `main` (PRs #15–#19); T5 done and committed on
`feat/phase-3-05-sku-search` (pushed, **no PR yet, native review pending**); T6–T7 not started; one product decision
open. **Start with "Resume here" below.**

## Resume here (handoff 2026-10-15)

1. `git fetch origin && git switch feat/phase-3-05-sku-search && pnpm install`; `.env.local` needs `MAGENTO_GRAPHQL_URL`
   (staging: `https://staging.chupaprecios.com.mx/graphql`, which has categories and products), `CHAPI_BASE_URL`,
   `PUBLIC_BASE_URL`. Check: `pnpm typecheck && pnpm lint && pnpm test` (927) and `pnpm test:integration` (81).
2. **T5 native review is pending.** The last `gentle-ai review start` consent for T5 (14 files, 1094 lines, up to
   `7e801e0`) was interrupted by the user before answering. Run `gentle-ai review status --cwd . --contract
   gentle-ai.review-integration/v2 --agent claude-code --next-transition` and follow the returned transition (relay the
   consent to the user). Earlier T5 reviews were approved; their warnings are fixed in `90d7e4f` and `7e801e0`.
3. Then open the T5 PR from `feat/phase-3-05-sku-search` (compare link; `gh` is not installed on this machine). Tell
   the user to merge only after the last push (twice a PR was merged before the follow-up commits landed: #14 and #18).
4. **Open decision (ask the user first):** product URLs built from CHAPI titles use the legacy slug (non-ASCII → `-`,
   e.g. `perforaci-n`) while Magento url keys drop non-ASCII characters (`perforacin`). Search result cards and the
   `-search.html` canonical therefore point to a `noindex` missing-product URL instead of the indexable Magento page
   for products Magento already has. Options offered: (1, recommended) build the slug like Magento (drop non-ASCII),
   verified against several real staging products, in its own branch after T5; (2) look the product up in Magento by
   sku and redirect (`products(filter: {sku})` answers "Internal server error" on staging today); (3) leave it as a
   follow-up.
5. Then T6 (GTM search events, recommendation sliders from Magento `randomProducts`) and T7 (phase 3 routing doc:
   delete the temporary phase 2 search rules 5 and 6, prerender, env vars, phase 3 report, e2e smoke).

Open follow-ups (no decision needed now): acme base64url `-` SKU limitation (count affected Magento SKUs before any
format change); `useSearchParams` in the header without Suspense relies on every route being dynamic; header
integration assertions depend on HTML attribute order; prev link clamped to page 1 label; search item slug keeps a
trailing `-`; canonical with a literal `%` for missing products (phase 1); the product module imports
`buildSearchItemUrlKey` from `search/domain` (move it to the product domain).

Working notes for the next session: the user writes in Spanish (Rioplatense replies); commits use
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
- [x] T5 (sku jump 44ad0f1; general placeholder fix + review fixes 90d7e4f; url-key hardening 7e801e0, all on `feat/phase-3-05-sku-search`, not merged; test 927, integration 81) `*-search.html` SKU jump: do not trust Magento `route()` for `/{store}-{sku}-search.html` (placeholder
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

## Next step

See "Resume here" at the top of this file (handoff 2026-10-15). Entries below are the detailed T5 log.

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
