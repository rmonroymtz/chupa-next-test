# Environment variables

Full reference for the storefront environment, generated from the zod schema in `src/shared/config/env.ts`, the
build-time config in `next.config.ts`, `playwright.config.ts`, the e2e specs and the `Dockerfile` (2026-10-13).
Copy the block into `.env.local` for local work. The block is identical to the committed `.env.example`.

```dotenv
# =============================================================================
# Chupaprecios storefront environment
# Server variables are validated with zod on first use (src/shared/config/env.ts),
# not during `next build`. Blank or whitespace-only values count as unset, so defaults apply.
# BUILD TIME variables are baked into the image (Docker --build-arg); changing them needs a rebuild.
# =============================================================================

# === App / site ==============================================================
# REQUIRED. Public origin of the storefront (http/https). Used for canonical URLs,
# SEO tags and structured data. Trailing slashes are stripped. No default.
PUBLIC_BASE_URL=https://chupaprecios.com.mx

# Optional. Vendors whose product URLs (/{vendor}-{sku}-{slug}.html) Next serves.
# Comma-separated, lowercase alphanumeric only (no "-", because URLs are split on it).
# Default when unset: amazon,ebay,target,acme
PRODUCT_VENDORS=amazon,ebay,target,acme

# Optional. User-Agent matchers that identify crawlers and link-preview bots.
# Comma- or newline-separated, case-insensitive; each entry is a substring or a regex source.
# Default when unset: built-in list (googlebot, bingbot, yandex, duckduckbot, baiduspider,
# applebot, facebookexternalhit, twitterbot, whatsapp, telegrambot, slackbot, linkedinbot, ...).
# BOT_USER_AGENTS=googlebot,bingbot,facebookexternalhit

# === Magento =================================================================
# REQUIRED. Magento GraphQL endpoint (http/https URL). No default.
MAGENTO_GRAPHQL_URL=https://magento.example.com/graphql
# Optional. Sent as the `Store` header on every Magento GraphQL request. Default: default
MAGENTO_STORE_CODE=default
# Optional. Sent as the `Content-Currency` header. ISO 4217 code, upper-cased automatically. Default: MXN
MAGENTO_CURRENCY=MXN
# Optional. Per-request timeout for Magento queries, in ms. Default: 5000
MAGENTO_TIMEOUT_MS=5000
# Optional. Timeout for the header category menu query, in ms. Kept short: the menu
# streams in its own Suspense boundary and the header renders without it. Default: 1500
MAGENTO_MENU_TIMEOUT_MS=1500
# Optional. Timeout for the background "copy product to Magento" mutation, in ms.
# It never blocks the response. Default: 10000
COPY_MUTATION_TIMEOUT_MS=10000

# === CHAPI (internal scraper API) ============================================
# REQUIRED. Base URL of CHAPI (http/https). Trailing slashes are stripped. No default.
# Internal address: do not commit the real value.
CHAPI_BASE_URL=https://chapi.example.com
# Optional. Per-request timeout for CHAPI, in ms. Default: 15000
CHAPI_TIMEOUT_MS=15000

# === SEO (structured data) ===================================================
# Optional. Absolute http(s) URL of the organization logo for Organization JSON-LD.
# Default: unset (no logo emitted).
ORGANIZATION_LOGO_URL=
# Optional. Official social profile URLs for Organization `sameAs`.
# Comma-separated absolute http(s) URLs; any invalid entry fails validation. Default: empty.
ORGANIZATION_SAME_AS=

# === Images (BUILD TIME) =====================================================
# Optional, BUILD TIME (next.config.ts -> images.remotePatterns, also inlined for the UI).
# Hosts next/image may optimize: comma-separated `host` or `host/path/**`, https only.
# URLs with a query string always render unoptimized.
# Default when blank: chupaprecios.com.mx/media/**,i.ebayimg.com,m.media-amazon.com,target.scene7.com
IMAGE_REMOTE_HOSTS=

# === Server Actions (BUILD TIME) =============================================
# Optional, BUILD TIME (next.config.ts -> experimental.serverActions.allowedOrigins).
# Extra hosts accepted by the Server Action origin (CSRF) check: comma-separated hosts,
# optional :port, `*.` / `**.` subdomain wildcards. An invalid entry fails the build.
# Leave empty when the proxy forwards the public host as X-Forwarded-Host.
# Example: chupaprecios.com.mx,www.chupaprecios.com.mx. Default: empty (same origin only).
SERVER_ACTIONS_ALLOWED_ORIGINS=

# === Observability / logging =================================================
# Optional. pino log level: fatal | error | warn | info | debug | trace | silent. Default: info
LOG_LEVEL=info
# Optional. CloudWatch namespace for Embedded Metric Format output. Default: ChupaStorefront
METRICS_NAMESPACE=ChupaStorefront

# === Runtime (set by the Dockerfile; override only if needed) ================
# NODE_ENV=production
# PORT=3000                  # standalone server.js port; also used by the HEALTHCHECK
# HOSTNAME=0.0.0.0           # bind address of the standalone server
# NEXT_TELEMETRY_DISABLED=1

# === E2E (Playwright; not used by the app) ===================================
# Optional. Base URL of a real environment. When set, only the `pwa-checkout` project runs
# against it (it creates a real guest cart). Do not commit a real value.
# E2E_BASE_URL=https://staging.example.com
# Optional. Path of an in-stock product served by Next, used with E2E_BASE_URL.
# E2E_PRODUCT_PATH=/amazon-B0XXXXXXX-some-product.html
# Optional. CI flag: when truthy, Playwright fails on test.only.
# CI=
# E2E_LOCAL_BASE_URL is set automatically by e2e/support/local-stack.ts; do not set it by hand.
```

## `.env.example`

The committed `.env.example` documents every variable above, including the E2E ones, with the same defaults and
comments. Keep both in sync when a variable changes.

## Values that must not be committed

The app reads no credentials. Keep the real `CHAPI_BASE_URL` (internal address) and any real `E2E_BASE_URL` (tests
create real carts there) out of git.
