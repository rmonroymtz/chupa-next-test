# Phase 2 routing: home and category pages move to Next

Phase 2 adds **the home page (`/`) and the native Magento category pages (`/{url_path}.html`)** to what the edge sends to the Next.js storefront. It builds on the [phase 1 rules](phase-1.md), which stay in place. Search (`/search.html`, `*-search.html`), cart, checkout and account keep going to PWA Studio. Rolling back means deleting the three phase 2 rules.

This document is for whoever operates the edge (CloudFront or nginx). The configs are **examples to adapt**, not drop-in files.

## Quick path

1. Keep every phase 1 rule. Add a PWA rule for `/search.html` (exact) next to the existing `*-search.html` rule.
2. Add, **after** both search rules: `/` → Next, `/{cms_home_page}` (today `/venia-new-home`) → Next, `*.html` → Next.
3. Remove the prerender service for `/` and `*.html` (except the two search rules).
4. Run the [checklist](#checklist), then watch 404 and 5xx rates on Next for a day.

## What changes

| Request                                            | Phase 1 | Phase 2 | Why                                                                            |
| -------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------ |
| `/`                                                | PWA     | Next    | Next resolves `/` through Magento `route()` (the configured home CMS page).    |
| `/{cms_home_page}` (`/venia-new-home` today)       | PWA     | Next    | Next answers `308 → /` (query string kept), so the home has one indexable url. |
| Category `/{url_path}.html`, nested or not         | PWA     | Next    | Indexable category pages from Magento data (products, breadcrumbs, JSON-LD).   |
| `/search.html`, `*-search.html`                    | PWA     | PWA     | Search moves in phase 3. Must match **before** the `*.html` rule.              |
| Product, listed CMS paths, Next internals          | Next    | Next    | Unchanged phase 1 rules.                                                       |
| Cart, checkout, account, other PWA pages, `/api/*` | PWA     | PWA     | Unchanged.                                                                     |

### Why the home moves now

Phase 1 kept `/` on PWA because Next only had a placeholder home. Since phase 2 (T1), Next renders `/` from Magento: `route(url: "/")` returns the CMS page configured as `storeConfig.cms_home_page` (`venia-new-home`), rendered with its Page Builder content, canonical `/`. That page's own url (`/venia-new-home`) redirects `308 → /`. If the edge sent `/` to Next but left `/venia-new-home` on PWA, PWA would keep serving the home under a second url; route both.

If Magento's home page is ever changed to another CMS page, update the `/{cms_home_page}` rule to the new identifier.

## Telling categories apart from other `.html` urls

**The edge cannot tell a category url from other `.html` urls by pattern.** Category urls are `/{url_path}.html` with no prefix (`/herramientas.html`, `/computo/monitores-y-perifericos.html`); any url key is possible. Product urls are only recognizable because of the `{vendor}-` prefix. Only Magento knows which url is a category.

What each kind of `.html` url is, and what Next does with it today (checked on the dev server against staging, 2026-10-15):

| `.html` url                                | Owner          | Next answers                                       |
| ------------------------------------------ | -------------- | -------------------------------------------------- |
| `/{url_path}.html` category (incl. nested) | Next (phase 2) | 200, or 404 when Magento has no such category      |
| `/{vendor}-{sku}-{slug}.html`              | Next (phase 1) | product page (unchanged)                           |
| Magento url rewrite of type redirect       | Next           | 307/308 to the target                              |
| `/search.html`                             | PWA (phase 3)  | **404**: Next has no search page                   |
| `/{store}-{query}-search.html`             | PWA            | **wrong**: parsed as product `{query}` (200 shell) |
| Unknown `.html`                            | either         | 404 (`noindex`)                                    |

Next resolves every url through Magento `route()` and answers 404 for anything Magento does not know, so sending it a non-category `.html` url is safe **except for the two search urls**, which must stay above the `*.html` rule. PWA Studio (Venia `MagentoRoute`) resolves unknown urls with the same Magento lookup, so Next and PWA agree on what exists. Other PWA routes (`/cart`, `/checkout`, `/sign-in`, `/my-account`, `/contact-us`...) have no `.html` suffix and are not affected; Next answers 404 for them if they ever reach it.

### Options

| Option                                             | How                                                                                                | Pros                                                                                                   | Cons                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. All remaining `.html` to Next** (recommended) | `/search.html` and `*-search.html` → PWA, then `*.html` → Next.                                    | One rule. New or renamed categories work without an edge change. Same 404 decision as PWA (`route()`). | Any future PWA-only `.html` page needs its own PWA rule above `*.html`. Unknown `.html` urls now get Next's 404 instead of PWA's.                                          |
| B. Explicit list of category paths                 | One exact rule per category (nginx `include`, or CloudFront behaviors), from Magento url rewrites. | Only known categories move; everything else stays on PWA.                                              | Must be regenerated whenever a category is added or renamed. Staging already has dozens of nested categories; CloudFront's default quota is 25 behaviors per distribution. |
| C. Prefix or header                                | Change category urls to `/c/...`, or have the edge look up the url type.                           | Unambiguous.                                                                                           | A prefix changes Magento urls (out of scope: no Magento changes) and breaks indexed urls. An edge lookup adds a Magento call and latency to every request.                 |

**Recommendation: option A.** It needs one rule, follows Magento automatically, and Next already handles every non-category `.html` url correctly once the two search rules match first. Before go-live, list Magento's non-category, non-product `.html` url rewrites (CMS pages with `.html` keys, custom rewrites) to confirm nothing there should stay on PWA:

```sql
SELECT entity_type, COUNT(*) FROM url_rewrite
WHERE request_path LIKE '%.html' AND store_id IN (0, 1) GROUP BY entity_type;
```

Also confirm PWA Studio serves no static `.html` file that browsers request directly (for example an offline page or `index.html`).

## Rules in order

First match wins. Phase 1 rules keep their place; phase 2 adds rows marked **new**.

| #   | Request                                                               | Origin     | Methods    | Note                                                                                           |
| --- | --------------------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------- |
| 1-3 | `/_next/static/*`, `/_next/image*`, `/images/layout/*`, `/robots.txt` | Next       | as phase 1 | Unchanged.                                                                                     |
| 4   | `/healthz`                                                            | not public |            | Unchanged.                                                                                     |
| 5   | `/search.html` (exact) **new**                                        | PWA        | as today   | Search, phase 3. Above rule 8.                                                                 |
| 6   | `*-search.html`                                                       | PWA        | as today   | Unchanged; above rule 8 and the product rules.                                                 |
| 7   | product (`/{vendor}-*.html`), listed CMS paths                        | Next       | all        | Unchanged. Redundant with rule 8 for products; keep it so rollback only deletes phase 2 rules. |
| 8   | `*.html` **new**                                                      | Next       | all        | Categories (any depth), plus anything else Magento resolves.                                   |
| 9   | `/` (exact) **new**                                                   | Next       | all        | Home.                                                                                          |
| 10  | `/{cms_home_page}` (exact, `/venia-new-home`) **new**                 | Next       | all        | 308 → `/`.                                                                                     |
| 11  | Magento paths, `/api/*`                                               | as today   |            | Unchanged.                                                                                     |
| 12  | everything else                                                       | PWA        | as today   | Cart, checkout, account, PWA assets.                                                           |

All methods on rules 8-10: the header mini cart and add to cart use Server Actions, which `POST` to the page url itself. The headers Next needs (real `User-Agent`, `X-Forwarded-Host`, every query string, Next's `RSC`/`Next-*` headers) are the same as in [phase 1](phase-1.md#headers-next-needs).

## CloudFront example

Add three behaviors and one PWA behavior to the phase 1 set. Lower precedence number wins.

| Precedence     | Path pattern                            | Origin   | Methods    | Cache policy      | Origin request policy |
| -------------- | --------------------------------------- | -------- | ---------- | ----------------- | --------------------- |
| 0-3            | phase 1 (Next internals, `/robots.txt`) | Next     | as phase 1 | as phase 1        | as phase 1            |
| before 4       | `/search.html` **new**                  | PWA      | as today   | as today          | as today              |
| 4              | `*-search.html`                         | PWA      | as today   | as today          | as today              |
| 5-9…           | phase 1 products and CMS paths          | Next     | all        | `CachingDisabled` | `AllViewer`           |
| after products | `/` **new**                             | Next     | all        | `CachingDisabled` | `AllViewer`           |
| next           | `/venia-new-home` **new**               | Next     | all        | `CachingDisabled` | `AllViewer`           |
| next           | `*.html` **new**                        | Next     | all        | `CachingDisabled` | `AllViewer`           |
| —              | existing Magento and `/api/*` behaviors | as today |            |                   |                       |
| default        | `*`                                     | PWA      | as today   | as today          | as today              |

Notes:

- `*.html` matches nested paths (`/computo/monitores-y-perifericos.html`) because `*` crosses `/` in CloudFront patterns. Patterns are case-sensitive; Magento category urls are lower case.
- `*-search.html` does not match `/search.html` (no `-` before `search`), so it needs its own behavior.
- **Default root object**: if the distribution sets one (for example `index.html`), CloudFront requests `/index.html` from the origin instead of `/`; it would then match `*.html` and Next would answer 404. Confirm it is empty before adding the `/` behavior.
- If the console rejects `/` as a path pattern, route the root with the mechanism the distribution already uses for PWA's root, or a viewer-request function that selects the Next origin for `/`; verify with the checklist.
- Behavior count: phase 2 adds four (three Next, one PWA). Check the distribution's behavior quota (default 25) against the phase 1 CMS list.

## nginx example

```nginx
    # Phase 2. Keep the phase 1 locations; regex locations match in file order.

    # 5. Search stays on PWA (phase 3). Exact match beats every regex.
    location = /search.html      { proxy_pass http://pwa_studio; }   # plus the existing PWA/prerender config
    # 6. Phase 1 `location ~ -search\.html$` stays before the regexes below.
    # 7. Phase 1 product regex and CMS includes stay as they are.

    # 9-10. Home and the home CMS page's own url
    location = /                 { include snippets/storefront-next.conf; }
    location = /venia-new-home   { include snippets/storefront-next.conf; }

    # 8. Every other .html url (categories, any depth); after the search regex
    location ~ \.html$           { include snippets/storefront-next.conf; }
```

`= /` matches only the root; the existing `location /` keeps sending everything else to PWA.

## Prerender service

Remove the prerender service for the new Next routes too: `/`, `/venia-new-home` and every `.html` url except `/search.html` and `*-search.html`. Next renders full HTML with metadata, canonical, robots and JSON-LD for every user agent. Keep prerender for everything that stays on PWA, including `/search.html`, `*-search.html` and the account/checkout pages.

## Caching

- **No caching.** Every Next page is `force-dynamic` with no data cache and answers with a `Cache-Control` that includes `no-store`. Use `CachingDisabled` (or nginx without `proxy_cache`) for rules 8-10.
- Unlike missing products, category and home status does **not** depend on the user agent, but keep caching off: the CDN caching policy is a separate infra decision for a later phase.
- Never cache `POST` (Server Actions).

## Rollback

Every route still exists on PWA Studio, so rollback is a routing change only:

- **CloudFront:** delete the `/`, `/venia-new-home` and `*.html` behaviors (keeping the `/search.html` PWA behavior is harmless), re-enable prerender for those paths, wait for the deployment.
- **nginx:** remove `location = /`, `location = /venia-new-home` and `location ~ \.html$`, restore prerender for them, `nginx -t && nginx -s reload`.
- Phase 1 rules (products, CMS list, `robots.txt`) are untouched by the rollback.

## Checklist

Run against the edge after the change. `B` is the public origin; use a staging category with products (production categories have none today).

```sh
B=https://<public-domain>
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
code() { curl -s -o /dev/null -A "$UA" -w '%{http_code} %{redirect_url}\n' "$B$1"; }
head_tags() { curl -s -A "$UA" "$B$1" | grep -oE '<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>'; }

code /                                      # 200
head_tags /                                 # canonical $B (root), robots index, follow
code /venia-new-home                        # 308 $B/
code '/venia-new-home?utm_source=x'         # 308 $B/?utm_source=x
code /herramientas.html                     # 200
head_tags /herramientas.html                # canonical $B/herramientas.html, index, follow
code /computo/monitores-y-perifericos.html  # 200 (nested category)
code '/herramientas.html?page=2'            # 307 $B/herramientas.html (12 products, one page of 16 on staging)
code '/herramientas.html?page=abc'          # 307 $B/herramientas.html
code /no-such-category-e2e.html             # 404
curl -sI -A "$UA" "$B/herramientas.html" | grep -i '^vary'   # contains rsc (served by Next)
curl -sI -A "$UA" "$B/search.html?query=x" | grep -i '^vary' # no rsc (served by PWA)
```

- [ ] `/` and `/venia-new-home` behave as above; the home renders the slider, header and footer.
- [ ] A top-level and a nested category answer 200 with products, canonical without `?page`, `index, follow` (an empty category: `noindex, follow`).
- [ ] `?page=abc` and a page beyond the last answer 307 to the clean category url.
- [ ] `/search.html?query=x` and `/amazon-x-search.html` still reach PWA (no `Vary: rsc`; PWA search results).
- [ ] `/cart`, `/checkout`, `/sign-in`, `/my-account` still reach PWA.
- [ ] Add to cart from a product page and the mini cart from a category page work (Server Action `POST`).
- [ ] `/robots.txt` unchanged (from Next, `Sitemap: $B/sitemap.xml`).
- [ ] Prerender no longer receives `/` or category urls.
- [ ] Menu links on `/` point to category pages, not `/search.html`.

The same checks, minus the routing ones, run as a read-only Playwright smoke (staging or a dev server only, never production while its categories are empty):

```sh
E2E_BASE_URL=$B E2E_PHASE2_SMOKE=1 pnpm test:e2e --project phase-2-smoke
```

## Next step

Phase 3 moves `/search.html` to Next (CHAPI search). Until then rules 5 and 6 must stay above `*.html`.
