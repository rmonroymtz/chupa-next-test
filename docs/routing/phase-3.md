# Phase 3 routing: search moves to Next

Phase 3 sends **the search page (`/search.html`) and the SKU search shortcut (`/{store}-{sku}-search.html`)** to the Next.js storefront. With the [phase 2 rules](phase-2.md) in place, that is a deletion, not an addition: removing the **temporary** phase 2 rules 5 and 6 lets both urls fall through to the existing Next rules (`*.html`, and the product rule for vendor urls). Cart, checkout and account keep going to PWA Studio. Rolling back means adding the two PWA rules back.

This document is for whoever operates the edge (CloudFront or nginx). The configs are **examples to adapt**, not drop-in files.

## Quick path

1. Make sure the [phase 2 rules](phase-2.md#rules-in-order) are live (if they are not, see [Without the phase 2 rules](#without-the-phase-2-rules)).
2. Delete the temporary rules 5 (`/search.html` → PWA) and 6 (`*-search.html` → PWA).
3. Remove the prerender service for `/search.html` and `*-search.html`: after this change, no `.html` url goes to prerender.
4. Run the [checklist](#checklist), then watch `SearchPage`, `ChapiError` (`Operation` search) and 5xx rates on Next for a day.

## What changes

| Request                                               | Phase 2 | Phase 3 | Why                                                                                        |
| ----------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------ |
| `/search.html` (any query string)                     | PWA     | Next    | Next renders the CHAPI search page (single store or ChupaChoice), `noindex, follow`.       |
| `/{vendor}-{sku}-search.html` (amazon, ebay, …)       | PWA     | Next    | Next renders the CHAPI product for that sku on the same url, `noindex`; bots get 404.      |
| Other `*-search.html` (e.g. `/walmart-1-search.html`) | PWA     | Next    | Through Magento like any `.html` url; the legacy search bar never builds them (see below). |
| Home, categories, products, listed CMS paths          | Next    | Next    | Unchanged phase 1 and 2 rules.                                                             |
| Cart, checkout, account, other PWA pages, `/api/*`    | PWA     | PWA     | Unchanged.                                                                                 |

### What Next answers

Checked on the dev server (2026-10-16). `UA` is a browser, `Bot` is Googlebot (any `BOT_USER_AGENTS` match).

| Url                                              | UA                                                                             | Bot                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `/search.html?query=q&store=amazon`              | 200, results grid, filters, sort, pagination, `noindex, follow`                | 200, heading with the query, no results, no CHAPI call |
| `/search.html?query=q` (or `store=chupachoice`)  | 200, ChupaChoice view: amazon, ebay, target and acme lists                     | as above                                               |
| `/search.html?query=q&store=walmart` (not CHAPI) | 307 → same url with `store=chupachoice` (`storeParams` dropped)                | same 307                                               |
| `/search.html` (blank query)                     | 200, "Escribe lo que quieres buscar.", no CHAPI call                           | same                                                   |
| CHAPI failure or timeout                         | 200, "No pudimos cargar los resultados." + "Reintentar", `noindex` (never 5xx) | —                                                      |
| `/amazon-{sku}-search.html`                      | 200, CHAPI product, `noindex, follow`, canonical = the product url             | 404 (`noindex`), no CHAPI, no Magento                  |

Every search page answers `Cache-Control: no-store` and `noindex, follow`. `robots.txt` already disallows `/*?*`, so no search url with a query is crawled; the `noindex` covers links that reach crawlers anyway.

## Rules in order

First match wins. This is the [phase 2 table](phase-2.md#rules-in-order) with rules 5 and 6 deleted; the other numbers are kept so both documents read the same.

| #     | Request                                                               | Origin     | Methods    | Note                                                                                     |
| ----- | --------------------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------- |
| 1-3   | `/_next/static/*`, `/_next/image*`, `/images/layout/*`, `/robots.txt` | Next       | as phase 1 | Unchanged.                                                                               |
| 4     | `/healthz`                                                            | not public |            | Unchanged.                                                                               |
| ~~5~~ | ~~`/search.html` (exact)~~ **deleted**                                | ~~PWA~~    |            | `/search.html` now matches rule 9.                                                       |
| ~~6~~ | ~~`*-search.html`~~ **deleted**                                       | ~~PWA~~    |            | Vendor urls now match rule 8, any other one rule 9.                                      |
| 7     | Magento paths (`/static/*`, `/media/*`, callbacks…), `/api/*`         | as today   | as today   | Unchanged. Still **above `*.html`**: the only ordering constraint left for `.html` urls. |
| 8     | product (`/{vendor}-*.html`), listed CMS paths                        | Next       | all        | Unchanged. Now also serves `/{vendor}-{sku}-search.html`.                                |
| 9     | `*.html`                                                              | Next       | all        | Unchanged. Now also serves `/search.html`.                                               |
| 10    | `/` (exact)                                                           | Next       | all        | Unchanged.                                                                               |
| 11    | `/{cms_home_page}` (exact, `/venia-new-home`)                         | Next       | all        | Unchanged.                                                                               |
| 12    | everything else                                                       | PWA        | as today   | Cart, checkout, account, PWA assets.                                                     |

All methods on `/search.html`: the header mini cart uses Server Actions, which `POST` to the page url itself (rule 9 already allows every method). Forward every query string untouched: `storeParams` is an opaque CHAPI link (sort, filters, pagination) and must reach Next byte for byte. The other headers are the same as in [phase 1](phase-1.md#headers-next-needs); the **real `User-Agent`** matters here too, because it decides whether CHAPI is called.

## CloudFront example

Delete the two PWA behaviors added for search:

| Precedence | Path pattern                         | Action     |
| ---------- | ------------------------------------ | ---------- |
| before 4   | `/search.html` (phase 2, temporary)  | **delete** |
| 4          | `*-search.html` (phase 1, temporary) | **delete** |

Nothing is added: `/search.html` then matches the `*.html` behavior and `/amazon-…-search.html` the `/amazon-*.html` behavior, both `CachingDisabled` + `AllViewer` (all query strings, viewer `User-Agent`). Phase 3 frees two behaviors from the quota.

## nginx example

```nginx
    # Phase 3: delete both search locations; nothing replaces them.
    # location = /search.html      { proxy_pass http://pwa_studio; }   # phase 2 rule 5
    # location ~ -search\.html$    { proxy_pass http://pwa_studio; }   # phase 1/2 rule 6
    #
    # /search.html now reaches `location ~ \.html$` (rule 9) and
    # /{vendor}-{sku}-search.html the product regex (rule 8).
```

Check that no other location (prerender, legacy rewrites) still names `search.html`: `grep -rn 'search' /etc/nginx/`.

## Prerender service

Remove the prerender service for `/search.html` and `*-search.html`. After phase 3 the prerender service receives **no `.html` url at all**; it stays only for what is still on PWA (cart, checkout, account and other PWA pages).

Search pages must not be prerendered or cached by any prerender service:

- They are dynamic per request (query, store, CHAPI results) and `noindex`; a prerendered copy would be stale and is never indexed anyway.
- The bot rule needs the **real** crawler `User-Agent` at Next: bots get a search page without results and a 404 on `*-search.html`, with no CHAPI call. A prerender renderer (a headless browser with its own User-Agent) would be treated as a shopper, call CHAPI for every crawler hit and hand the crawler a full results page.

If the edge sends bots to prerender by User-Agent (a bot-only rule), exclude `/search.html` and `*-search.html` from that rule too.

## Caching

- **No caching.** The search page and the SKU search page are `force-dynamic`, use no data cache and answer `Cache-Control: no-store`. Keep `CachingDisabled` (or nginx without `proxy_cache`) on rules 8 and 9.
- **Content and status depend on the user agent**: bots get a page without results on `/search.html` and a 404 on `*-search.html`. If these pages are ever cached, the cache key must separate bots from shoppers, and must include the whole query string.
- Never cache `POST` (Server Actions).

## Without the phase 2 rules

If phase 3 goes live while the edge still has only the [phase 1 rules](phase-1.md#summary):

- Add `/search.html` (exact) → Next, all methods, `CachingDisabled` + `AllViewer`, without prerender.
- Delete the phase 1 `*-search.html` → PWA rule (rule 5 there). Vendor urls then match the phase 1 product rule; any other `*-search.html` stays on PWA (default rule).

Applying phase 2 first is simpler: phase 3 is then only the two deletions above.

## Rollback

PWA Studio still serves search, so rollback is a routing change only:

- **CloudFront:** add back the `/search.html` and `*-search.html` behaviors to the PWA origin, **above** the `*.html` and `/{vendor}-*.html` behaviors, re-enable prerender for them, wait for the deployment.
- **nginx:** restore `location = /search.html` and `location ~ -search\.html$` (to PWA) before the product regex and `\.html$`, restore prerender for them, `nginx -t && nginx -s reload`.
- Phase 1 and 2 rules are untouched by the rollback.

## Not handled by the edge

| Item                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SKU jump from the search bar                      | The legacy search bar sends a sku query (amazon, ebay, target regexes) to `/{store}-{sku}-search.html`; the Next search bar always submits to `/search.html`. Next still serves the `*-search.html` urls that PWA pages and old links build.                                                                                                                                                                  |
| Non-vendor `*-search.html` and `/{x}-….html` urls | Next trusts Magento for urls whose prefix is not in `PRODUCT_VENDORS`: `/walmart-123456-search.html` answered 200 "External URL Placeholder" `index, follow` on the dev server (2026-10-16), same as `/walmart-123456-foo.html`, which already reaches Next under phase 2 rule 9. The search bars never build them. Follow-up in the [phase 3 report](../phase-3-report.md#known-limitations-and-follow-ups). |

## Checklist

Run against the edge after the change. `B` is the public origin; `Q` a query with results.

```sh
B=https://<public-domain>
Q=taladro
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
BOT='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
code() { curl -s -o /dev/null -A "${2:-$UA}" -w '%{http_code} %{redirect_url}\n' "$B$1"; }
robots() { curl -s -A "${2:-$UA}" "$B$1" | grep -oE '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>'; }

code "/search.html?query=$Q&store=amazon"              # 200
robots "/search.html?query=$Q&store=amazon"            # noindex, follow; no canonical
curl -sI -A "$UA" "$B/search.html?query=$Q" | grep -i '^vary'   # contains rsc (served by Next)
code "/search.html?query=$Q"                           # 200 (ChupaChoice)
code "/search.html?query=$Q&store=walmart"             # 307 $B/search.html?query=$Q&store=chupachoice
code /search.html                                      # 200 (blank query)
code "/search.html?query=$Q&store=amazon" "$BOT"       # 200 (no results, no CHAPI)
code /amazon-B00IJ0ALYS-search.html                    # 200
robots /amazon-B00IJ0ALYS-search.html                  # noindex, follow; canonical /amazon-B00IJ0ALYS-….html
code /amazon-B00IJ0ALYS-search.html "$BOT"             # 404
```

- [ ] A single-store search shows products, filters, sort and pagination; following a page, sort or filter link keeps working (`storeParams` reaches Next unchanged).
- [ ] `/search.html?query=…` without a store shows the four ChupaChoice lists.
- [ ] A non-CHAPI store answers 307 to `store=chupachoice`; a blank query shows the empty prompt.
- [ ] Every search page has `noindex, follow` and `Cache-Control: no-store`; a bot gets no results.
- [ ] `/amazon-<sku>-search.html` renders the CHAPI product (not a Magento placeholder), `noindex`; a bot gets 404.
- [ ] The search bar submits to `/search.html` on Next from the home, a category and a product page.
- [ ] Add to cart and the mini cart work on a search result's product page; the mini cart opens on `/search.html` (Server Action `POST`).
- [ ] `/cart`, `/checkout`, `/sign-in`, `/my-account` still reach PWA.
- [ ] Prerender no longer receives `/search.html` or `*-search.html` (nor any other `.html` url).
- [ ] With `GTM_ID` set: a single-store search pushes `search` and `view_item_list` to `dataLayer`; ChupaChoice pushes neither.

The same checks, minus the routing ones, run as a read-only Playwright smoke (staging or a dev server; it calls CHAPI):

```sh
E2E_BASE_URL=$B E2E_PHASE3_SMOKE=1 pnpm test:e2e --project phase-3-smoke
```

## Next step

Phase 3 removes the last temporary search rules. Later phases move what is still on PWA (cart, checkout, account); see the [phase 3 report](../phase-3-report.md).
