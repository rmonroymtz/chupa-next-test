# Phase 2 report: home and category pages on Next.js

Phase 2 makes the Next.js storefront serve **the home page and the native Magento category pages**, both resolved through Magento `route()` like phase 1's product and CMS pages. Categories are indexable pages built from Magento data (no CHAPI), and the menu now links to them instead of `/search.html`. It is ready to deploy; go-live needs the edge change in [`docs/routing/phase-2.md`](routing/phase-2.md) and the pending items below.

## At a glance

| Area                                                                | Status                                    |
| ------------------------------------------------------------------- | ----------------------------------------- |
| Home `/` from Magento (`cms_home_page`), canonical `/`, own url 308 | Done (PR #9)                              |
| CMS override registry and `<CmsBlock>`                              | Done (PR #10), no override registered yet |
| Category data (category, products, pagination, indexability)        | Done (PR #11)                             |
| Category page (grid, pagination, empty state, metadata)             | Done (PR #12)                             |
| Category SEO and menu links (breadcrumbs, JSON-LD, `categoryHref`)  | Done (PR #13)                             |
| Edge routing doc, report, e2e smoke                                 | Done (T6)                                 |
| Edge change and real-environment checks                             | Pending (see below)                       |

## What was built

| Task | PR  | What it does                                                                                                                                                                                                                                                                                                            |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | #9  | `src/app/[...path]` became the optional catch-all `src/app/[[...path]]` and the placeholder home was deleted: `/` is `route(url: "/")`, the configured `cms_home_page` (`venia-new-home`) rendered with Page Builder. Canonical `/` from the requested url; `/{cms_home_page}` answers 308 → `/` with the query string. |
| T2   | #10 | CMS override registry (`CMS_PAGE_OVERRIDES`, CMS identifier → Next page component; none → Magento content; Magento keeps metadata, 404 and redirects) and `<CmsBlock identifier>` (one `cmsBlocks` call, Page Builder renderer; missing → nothing, Magento failure → reject).                                           |
| T3   | #11 | `category` module: category and products by `category_uid`, `?page=N` with `storeConfig.grid_per_page`, indexability rule, invalid/out-of-range page → redirect. Product card mapping shared with Page Builder.                                                                                                         |
| T4   | #12 | Category branch in the catch-all (replaces phase 1's 404): product grid, pagination, empty state, title/description/canonical/robots.                                                                                                                                                                                   |
| T5   | #13 | Breadcrumbs UI, `CollectionPage`/`ItemList` + `BreadcrumbList` JSON-LD, PDP breadcrumb JSON-LD to category urls, every menu level to `categoryHref`, desktop menu scrolls horizontally with arrows, trailing site name stripped from Magento meta titles.                                                               |
| T6   | —   | [Phase 2 routing](routing/phase-2.md), this report, `e2e/phase-2-smoke.spec.ts`.                                                                                                                                                                                                                                        |

How each url resolves:

| Url                                 | Response                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `/`                                 | 200, configured home CMS page, canonical `/`; Magento failure 5xx; no entity 404 |
| `/{cms_home_page}`                  | 308 → `/` (query kept)                                                           |
| Category with products              | 200, `index, follow`, canonical = clean category url (no `?page`)                |
| Category without products           | 200, `noindex, follow`, empty state                                              |
| `?page=abc`, `< 1`, beyond the last | 307 → clean category url (other parameters kept)                                 |
| Category missing in Magento         | 404                                                                              |
| Magento failure                     | 5xx, never 404                                                                   |

## Key decisions

| Decision                                                                               | Why                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Categories = native Magento categories on `/{url_path}.html`, no CHAPI                 | These are the pages to index; the PWA "categories" (`/search.html?query=…`) are searches.             |
| `/search.html` stays on PWA; CHAPI search is phase 3                                   | Keeps phase 2 to Magento data only.                                                                   |
| Every menu level links to `categoryHref`                                               | Indexable category pages get internal links; `/search.html` links were blocked by robots `/*?*`.      |
| Magento resolves `/`; Next overrides per page by CMS identifier                        | Magento keeps content, metadata, 404 and redirects; Next can replace a page without hard-coding urls. |
| Override pieces are Magento CMS blocks by identifier                                   | Fragments of the page's own Page Builder content break when reordered in the admin.                   |
| Home canonical always `/`; `/{cms_home_page}` 308 → `/`                                | One indexable home url; `relative_url` would have made the canonical `/venia-new-home`.               |
| Home shows only the Magento Page Builder content                                       | The extra PWA home sections are customizations, out of scope until a later override.                  |
| Missing → 404, empty → 200 `noindex`, failure → 5xx                                    | Same indexability rule as phase 1; an outage is never a 404.                                          |
| `?page=N` on the server, size from `grid_per_page`, canonical without page, no filters | Like Venia; robots disallows query strings, so only the clean url is indexed.                         |
| Invalid or out-of-range page → 307 to the clean url                                    | A page beyond the last may exist later, so the redirect is temporary.                                 |
| Trailing site name stripped from Magento meta titles                                   | Avoids `…                                                                                             | Chupaprecios | Chupaprecios`. |
| Desktop menu scrolls horizontally with arrows                                          | The staging tree overflows one line.                                                                  |
| Edge: all remaining `.html` urls to Next, search urls first                            | The edge cannot tell categories from other `.html` urls; Next 404s what Magento does not know.        |

## Verification

| Check                                               | Result                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (Vitest)                                 | 726 after T5 (595 before T1)                                                                                                                      |
| Integration (real server, mock Magento)             | 56 after T5 (40 before T1): home, home redirect, outages, CMS overrides, categories, pagination                                                   |
| `typecheck`, `lint`, `build`                        | Green on every task                                                                                                                               |
| Native review                                       | T1–T5 approved                                                                                                                                    |
| Magento (read-only GraphQL, staging and production) | `route("/")`, `cms_home_page`, `grid_per_page` (16), `category_url_suffix` (`.html`), `categoryList` by uid, breadcrumbs, out-of-range error text |
| Dev server against staging                          | Home slider, header, footer; `/herramientas.html` 12 products; nested categories 200; 307 for `?page=abc`; 308 home url; 404 unknown              |
| `e2e/phase-2-smoke.spec.ts` against the dev server  | 5 passed (2026-10-15)                                                                                                                             |

## Pending before go-live

- [ ] **Edge change** ([phase 2 routing](routing/phase-2.md)): `/search.html` to PWA, then `/`, `/venia-new-home` and `*.html` to Next; prerender exclusions; run its checklist.
- [ ] **Non-category `.html` rewrites in Magento** reviewed (query in the routing doc), and no PWA static `.html` file requested directly.
- [ ] **Production categories have no products today** (10 native categories, no children); staging has the tree. Until Magento production is populated, every category page there is `200 noindex` with an empty state.
- [ ] **`.env.example` lines** for the new optional e2e variables (agents cannot edit `.env*`): `E2E_PHASE2_SMOKE`, `E2E_CATEGORY_PATH`, `E2E_HOME_CMS_PATH`, `E2E_UNKNOWN_HTML_PATH` (see `docs/environment.md`).
- [ ] Run `e2e/phase-2-smoke.spec.ts` against staging behind the edge (`E2E_PHASE2_SMOKE=1`).

## Known limitations and follow-ups

| Item                                                | Notes                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products named `-` are listed                       | Category grids show them as Magento returns them; not filtered.                                                                                                                               |
| PDP breadcrumb JSON-LD assumes `.html`              | Does not read `category_url_suffix`; production and staging both use `.html`.                                                                                                                 |
| CMS page whose only title is the site name          | Still renders the site name twice in `<title>`.                                                                                                                                               |
| Menu alignment on very wide screens                 | The first menu item is not aligned to the 1600px column above 1600px.                                                                                                                         |
| Duplicate `ProductByRoute` during an outage on `/`  | Observed once per request during a Magento outage (once on success); not investigated.                                                                                                        |
| `<CmsBlock>` failure → 5xx not proven at HTTP level | The test renders in-process, not through Next's RSC renderer. Prove it with the first real override, and assert the exact home canonical in `tests/unit/app/catch-all-cms-override.test.tsx`. |
| Home `products` carousel empty                      | Magento returns that content type with no products (empty div), so nothing renders.                                                                                                           |
| PWA home custom sections                            | Out of scope; the override registry and `<CmsBlock>` make them possible later.                                                                                                                |
| Legacy PWA source-of-truth folder                   | Parked by the user (`chupaprecios-pwa`, `chupaprecios-pwa-next`, `chpwa-v1`, `pwa-studio`); PWA-derived claims are unverified against it.                                                     |
| Category pages beyond page 1 are not crawled        | robots `Disallow: /*?*`; products only on later pages are reached through other links.                                                                                                        |
| No cache                                            | As in phase 1: each category page adds `categoryList` and `products` reads to `route()` and the menu query.                                                                                   |

## Next step

Apply the edge change in [phase 2 routing](routing/phase-2.md) on staging, run its checklist and the phase 2 smoke, then production once its categories have products. **Phase 3** moves `/search.html` to Next with a CHAPI search adapter.
