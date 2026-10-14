# Phase 1 routing: which origin serves each request

Phase 1 is a strangler migration on one domain: the edge (nginx or CloudFront) sends **product pages, the listed CMS pages, `robots.txt` and the Next.js assets** to the Next.js storefront. **Everything else keeps its current origin** (PWA Studio or Magento). Rolling back means removing the Next rules.

The configs below are **examples to adapt** to the current edge configuration, not drop-in files.

## Quick path

1. Add the Next rules in the order of the [summary table](#summary): Next internals first, the PWA search shortcut **before** the product rule, then products and the CMS list.
2. Forward the public host (`X-Forwarded-Host`) and the real `User-Agent` to Next.
3. Exclude the migrated routes from the prerender service; keep it for everything else.
4. Verify with the [checklist](#checklist), then watch `PdpOutcome`, `MagentoError` and 5xx rates.

## Summary

| #   | Request                                                                                       | Origin                                               | Why                                                            |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `/_next/static/*`, `/_next/image*`                                                            | Next                                                 | Build assets, self-hosted fonts, image optimizer.              |
| 2   | `/images/layout/*`                                                                            | Next                                                 | Header/footer logos and icons (`public/images/layout`).        |
| 3   | `/robots.txt`                                                                                 | Next                                                 | Same production rules, `Sitemap` from `PUBLIC_BASE_URL`.       |
| 4   | `/healthz`                                                                                    | not public                                           | Load balancer / ECS only. Block or let it fall to PWA.         |
| 5   | `*-search.html`                                                                               | **PWA**                                              | PWA SKU search shortcut. Must match **before** rule 6.         |
| 6   | `/{vendor}-{sku}[-{slug}].html`, vendor in `PRODUCT_VENDORS`                                  | Next                                                 | Product pages, all methods (Server Actions `POST`).            |
| 7   | Listed CMS paths (exact match)                                                                | Next                                                 | CMS pages, all methods.                                        |
| 8   | `/graphql`, `/rest/*`, `/media/*`, `/static/*`, `/stripe/*`, `/sitemap.xml`, `/sitemap-*.xml` | Magento (as today)                                   | Unchanged.                                                     |
| 9   | `/api/*`                                                                                      | PWA (as today; UPWARD proxies it to the scraper API) | Unchanged.                                                     |
| 10  | Everything else, including `/`                                                                | PWA                                                  | Home, search, categories, cart, checkout, account, PWA assets. |

## Next.js origin

### Product pages

URL shape: `/{vendor}-{sku}-{slug}.html`, parsed like legacy `urlKey.split('-')` (vendor, then sku; the slug is optional for Next). Vendors come from `PRODUCT_VENDORS` (default `amazon|ebay|target|acme`); keep the edge pattern in sync when that variable changes.

- The sku may contain a literal `|` or its encoding `%7C` (`/ebay-126981644035|428130345038-playera.html`). Both must reach Next unchanged; nginx matches locations on the decoded path, so one regex covers both.
- eBay variants use a query string (`?var=<id>`). Path rules ignore the query; forward it to the origin untouched.
- Vendor matching in Next is case-insensitive. CloudFront path patterns are case-sensitive, so `/Amazon-...` would stay on PWA there (legacy links are lower case).

nginx regex (case-insensitive):

```
^/(amazon|ebay|target|acme)-[^/]+\.html$
```

**Exclude the PWA search shortcut.** The PWA search bar sends a sku search to `/{store}-{query}-search.html` (`handleSubmit` in the PWA `useSearchBar.js` override). That path also matches the product pattern, and Next would treat it as product `{query}`. A rule for `-search.html` that sends it to PWA must win over the product rule (an nginx regex `location` listed first, or a CloudFront behavior with higher precedence). Side effect: a real product whose slug is exactly `search` would go to PWA; none is expected.

**Check before go-live:** no Magento category or CMS url key may start with `{vendor}-` and end in `.html` (e.g. `/amazon-ofertas.html`). Next serves no categories in phase 1 (404), so such a url would break. Query Magento url rewrites for `request_path LIKE 'amazon-%' ...` with `entity_type <> 'product'`.

### CMS pages

CMS urls have no common prefix (`/aviso-privacidad`, `/terminos-y-condiciones`...), so the edge needs an **explicit list of exact paths**. Next resolves each one through Magento `route()` and renders the page; anything not listed stays on PWA.

How to build the list (pick one, then review it by hand):

| Source               | How                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Magento admin        | Content → Pages grid, active pages, `URL Key` column (export CSV).                                                                                                          |
| Database (read-only) | `SELECT request_path FROM url_rewrite WHERE entity_type = 'cms-page' AND store_id IN (0, 1);` (adapt store ids), or `SELECT identifier FROM cms_page WHERE is_active = 1;`. |
| Sitemap              | CMS urls listed in Magento's `sitemap.xml`, if CMS pages are enabled there.                                                                                                 |

Magento GraphQL has no "list CMS pages" query (`cmsPage` needs an identifier), so it cannot produce the list.

Leave out:

- `home` (`/`). **Home stays on PWA in phase 1.** Since phase 2 (T1) Next resolves `/` through Magento `route()`
  (the configured `cms_home_page`, canonical `/`, its own url `/{cms_home_page}` → 308 `/`), but the edge must not
  route `/` or `/{cms_home_page}` to Next until the phase 2 routing change (T8).
- `no-route` (Magento's 404 page) and any page that only makes sense inside PWA.

Keep the list in one file (nginx `include`) so adding a page is a one-line change. A new CMS page stays on PWA until it is added.

### Next.js internals

| Path               | Notes                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `/_next/static/*`  | Hashed build assets and fonts (`/_next/static/media`). Immutable; Next sends long-lived cache headers for them. |
| `/_next/image*`    | Image optimizer; needs the query string (`url`, `w`, `q`).                                                      |
| `/images/layout/*` | Layout assets from `public/`. Verify PWA serves nothing under this prefix.                                      |
| `/robots.txt`      | Moves from PWA (UPWARD `staticFromRoot`) to Next with the same rules.                                           |
| `/healthz`         | Liveness only. Do not expose: `return 404` at the edge, or simply leave it unrouted (it then falls to PWA).     |

### Server Actions

Add to cart and the mini cart `POST` to the **page url itself** (a product or CMS path), so rules 6 and 7 already cover them: allow every method there (CloudFront: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`). No extra path is needed.

Next accepts an action only when the browser `Origin` host equals `X-Forwarded-Host` (else `Host`). Forward the public host (`proxy_set_header X-Forwarded-Host $host;` in nginx; viewer `Host` forwarded, or a CloudFront Function copying it into `X-Forwarded-Host`). Otherwise build the image with `SERVER_ACTIONS_ALLOWED_ORIGINS` (see [`docs/deploy/ecs-fargate.md`](../deploy/ecs-fargate.md)).

### Headers Next needs

- `User-Agent`: the **real** viewer UA. Bot detection decides the scraper call, the copy mutation and the status of missing products. CloudFront replaces it with `Amazon CloudFront` unless the origin request policy forwards it.
- `Host` / `X-Forwarded-Host`, `X-Forwarded-Proto`: Server Action origin check.
- Next's own request headers (`RSC`, `Next-Action`, `Next-Router-State-Tree`, `Next-Router-Prefetch`, `Next-Router-Segment-Prefetch`) and every query string.
- No cookies are needed.

## Stays on PWA Studio

- `/` (home), `/search.html`, `*-search.html`, category urls.
- `/cart`, `/checkout`, `/sign-in`, `/create-account`, `/forgot-password`, `/customer/account/createPassword`.
- Account: `/my-account`, `/my-account/*` (billing address, invoices), `/account-information`, `/address-book`, `/order-history`, `/saved-payments`, `/communications`, `/wishlist`, `/quotes`, `/social-accounts`.
- Other PWA pages: `/contact-us`, `/facturacion`, `/kueski`, `/chupachoice`.
- `/api/*` (UPWARD proxies it to the scraper API; the storefront calls the scraper server-side and defines no `/api` route).
- PWA static assets (root `*.js`, `*.css`, images, `favicon.ico`, `manifest.json`).

The route list comes from Venia `defaultRoutes.json` and the project intercepts (`dashboard`, `billing-module`, `one-step-checkout`, `social-login`, `kueski-payment`). The default rule already sends all of them to PWA; they are listed so nobody adds a Next rule over them.

## Stays on Magento

`/graphql`, `/rest/*`, `/media/*`, `/static/*`, `/stripe/*`, `/sitemap.xml`, `/sitemap-*.xml`: **keep the current rules**. UPWARD's `upward.yml` proxies `/graphql`, `/rest`, `/media` and `/stripe` to Magento; sitemaps and `/static` are not in it, so verify how the current edge routes them and leave that unchanged. The storefront generates no sitemap; `robots.txt` points to `${PUBLIC_BASE_URL}/sitemap.xml`.

## Prerender service

Remove the prerender service **only for the routes now served by Next** (rules 1–3, 6, 7): Next renders complete HTML with metadata, canonical and JSON-LD for every user agent. Keep it for everything that stays on PWA, including home, search, categories and `*-search.html`.

## Caching

- The storefront sets **no caching** for pages: every page is rendered per request, with no data cache. Only `/_next/static/*` carries Next's immutable cache headers.
- The CDN caching policy is **infra's decision**. Safe default for rules 3, 6 and 7: no caching (CloudFront managed policy `CachingDisabled`).
- **Status depends on the user agent** for product urls missing from Magento: shoppers get `200` with `noindex, follow` (scraped product), bots get `404`. If these pages are ever cached, the cache key must separate bots from shoppers (or not cache them at all); otherwise a cached `404` would reach shoppers, or a cached `200` would reach crawlers.
- Never cache `POST` (Server Actions).

## nginx example

Regex locations are checked in the order they appear and the first match wins, so put these **before** any existing regex location (such as static file rules). `^~` and `=` locations stop the regex search.

```nginx
upstream storefront_next {
    server storefront.internal:3000;   # ECS service / ALB target
    keepalive 32;
}

# /etc/nginx/snippets/storefront-next.conf
#   proxy_pass http://storefront_next;          # no URI part: the original path (and %7C) is kept
#   proxy_http_version 1.1;
#   proxy_set_header Connection "";
#   proxy_set_header Host $host;
#   proxy_set_header X-Forwarded-Host $host;    # Server Action origin check
#   proxy_set_header X-Forwarded-Proto $scheme;
#   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#   proxy_buffering off;                        # let the product page stream (Suspense)
#   proxy_read_timeout 30s;

server {
    server_name chupaprecios.com.mx;
    # ... existing listen/ssl settings ...

    # 1-3. Next internals and robots.txt
    location ^~ /_next/          { include snippets/storefront-next.conf; }
    location ^~ /images/layout/  { include snippets/storefront-next.conf; }
    location = /robots.txt       { include snippets/storefront-next.conf; }

    # 4. Liveness is for the load balancer only
    location = /healthz          { return 404; }

    # 5. PWA SKU search shortcut: must come before the product regex
    location ~ -search\.html$ {
        # existing PWA proxy (and prerender) configuration
        proxy_pass http://pwa_studio;
    }

    # 6. Product pages (keep the vendor list in sync with PRODUCT_VENDORS)
    location ~* ^/(amazon|ebay|target|acme)-[^/]+\.html$ {
        include snippets/storefront-next.conf;
    }

    # 7. CMS pages: one exact location per page, generated from Magento
    include snippets/storefront-cms.conf;
    #   location = /aviso-privacidad        { include snippets/storefront-next.conf; }
    #   location = /terminos-y-condiciones  { include snippets/storefront-next.conf; }

    # 8-10. Existing rules, unchanged: Magento paths, /api, PWA default with prerender
    # location / { ... }
}
```

## CloudFront example

Add a second origin (the storefront ALB) and these behaviors **above** the existing ones, in this order (lower number = higher precedence). Path patterns are case-sensitive globs, not regexes, so one behavior per vendor is needed.

| Precedence | Path pattern                                                                                                 | Origin   | Methods   | Cache policy                              | Origin request policy         |
| ---------- | ------------------------------------------------------------------------------------------------------------ | -------- | --------- | ----------------------------------------- | ----------------------------- |
| 0          | `/_next/static/*`                                                                                            | Next     | GET, HEAD | `CachingOptimized` (hashed, immutable)    | none                          |
| 1          | `/_next/image*`                                                                                              | Next     | GET, HEAD | infra decision (key on all query strings) | all query strings             |
| 2          | `/images/layout/*`                                                                                           | Next     | GET, HEAD | infra decision                            | none                          |
| 3          | `/robots.txt`                                                                                                | Next     | GET, HEAD | `CachingDisabled`                         | `AllViewer`                   |
| 4          | `*-search.html`                                                                                              | PWA      | as today  | as today                                  | as today                      |
| 5          | `/amazon-*.html`                                                                                             | Next     | all       | `CachingDisabled`                         | `AllViewer` (UA, host, query) |
| 6          | `/ebay-*.html`                                                                                               | Next     | all       | `CachingDisabled`                         | `AllViewer`                   |
| 7          | `/target-*.html`                                                                                             | Next     | all       | `CachingDisabled`                         | `AllViewer`                   |
| 8          | `/acme-*.html`                                                                                               | Next     | all       | `CachingDisabled`                         | `AllViewer`                   |
| 9…         | `/aviso-privacidad` (one per CMS path)                                                                       | Next     | all       | `CachingDisabled`                         | `AllViewer`                   |
| —          | existing behaviors (`/graphql*`, `/rest/*`, `/media/*`, `/static/*`, `/stripe/*`, `/sitemap*.xml`, `/api/*`) | as today |           |                                           |                               |
| default    | `*`                                                                                                          | PWA      | as today  | as today                                  | as today                      |

Notes:

- `AllViewer` forwards the viewer `Host`; the ALB certificate must then cover the public domain. If it does not, use `AllViewerExceptHostHeader` plus a viewer-request CloudFront Function that copies `Host` into `X-Forwarded-Host`, and allow that header in the origin request policy.
- `/healthz` needs no behavior (it falls to PWA). The ALB health check reaches the tasks directly.
- Each CMS page costs one behavior. Distributions have a default quota of 25 cache behaviors (adjustable); with a long list, nginx (exact `location` include) scales better.
- In CloudFront `*` also matches `/`, so `/amazon-x/y.html` reaches Next, which answers 404 for nested paths.

## Rollback

Every migrated route still exists on PWA, and the cart lives in the same browser storage, so rollback is a routing change only:

- **nginx:** remove (or comment out) rules 1–3, 6 and 7, restore the prerender rule for them, `nginx -t && nginx -s reload`.
- **CloudFront:** delete the Next behaviors (or point them to the PWA origin) and re-enable prerender for those paths. Wait for the distribution to deploy.
- Restore the PWA `robots.txt` route at the same time.

## Checklist

- [ ] `/ebay-<sku>|<variant>-<slug>.html` and the `%7C` form both reach Next (response has `<link rel="canonical">` with a literal `|`).
- [ ] `/amazon-<sku>-search.html` reaches PWA.
- [ ] `/` reaches PWA; `/search.html?query=x` reaches PWA.
- [ ] Each listed CMS path reaches Next; an unlisted one stays on PWA.
- [ ] `/robots.txt` comes from Next and lists `Sitemap: https://<domain>/sitemap.xml`; `/sitemap.xml` still comes from Magento.
- [ ] Add to cart on a product page succeeds (Server Action `POST` + origin check).
- [ ] A Googlebot UA on a missing product url gets `404`; a browser UA gets `200` with `noindex`.
- [ ] `/healthz` is not publicly reachable (or harmlessly falls to PWA).
- [ ] Prerender no longer receives migrated urls.
