# Phase 4 routing: cart and customer screens move to Next

Phase 4 sends **the cart page (`/cart`) and the three customer screens (`/sign-in`, `/create-account`, `/forgot-password`)** to the Next.js storefront. With the [phase 3 rules](phase-3.md) live, that is four new exact rules **above rule 12** (everything else → PWA). Checkout and the rest of the account (`/my-account/*`, `/order-history`, …) keep going to PWA Studio. Rolling back means deleting the four rules.

This document is for whoever operates the edge (CloudFront or nginx). The configs are **examples to adapt**, not drop-in files.

## Decide before go-live: social login

The legacy sign-in and create-account pages offer Google and Facebook buttons (Amasty social login). **The Next screens have none**: they only have email and password. Pick one before applying the rules:

| Option                     | Edge change                                                   | Effect                                                                                                     |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A. Everything now          | All four rules                                                | Shoppers lose the social buttons on these urls.                                                            |
| B. Cart and recovery first | Only `/cart` and `/forgot-password` (rules 12a and 12d below) | Sign-in and create-account stay on PWA with social login; the Next sign-in is not reachable from the edge. |

Option B is the conservative one. The Next header already links its account action to `/sign-in`, so under B that link lands on PWA (full page load).

## Quick path

1. Make sure the [phase 3 rules](phase-3.md#rules-in-order) are live.
2. Add the rules of the [table below](#rules-in-order) above the default (everything else → PWA) rule.
3. Exclude these urls from the prerender service (see [Prerender](#prerender-service)).
4. Run the [checklist](#checklist) and the phase 4 smoke, then watch `CartReadFailure`, `CartUpdateItem`, `CartRemoveItem`, `SignIn` and 5xx rates on Next for a day.

## What changes

| Request                                           | Phase 3 | Phase 4 | Why                                                                                      |
| ------------------------------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------- |
| `/cart`                                           | PWA     | Next    | Cart list, quantity, remove, price summary, quote and price-change notices. `noindex`.   |
| `/sign-in` (`?from=` kept)                        | PWA     | Next    | Next writes the session token itself (same storage as the PWA). `noindex`.               |
| `/create-account`                                 | PWA     | Next    | Creates the account, signs in, same token. `noindex`.                                    |
| `/forgot-password`                                | PWA     | Next    | Sends the reset email. `noindex`.                                                        |
| `/checkout`, `/my-account/*`, `/order-history`, … | PWA     | PWA     | Unchanged. The Next cart links to `/checkout`; the header account menu links to the PWA. |
| Everything from phases 1-3                        | Next    | Next    | Unchanged.                                                                               |

### What Next answers

| Url                                   | Answer                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/cart`                               | 200, `noindex, nofollow`, `Vary: rsc`. The cart id and token live in the browser (PWA `localStorage`), so the list is read after load: loading, then the empty state, the list or an error with "Reintentar". |
| `/sign-in?from=/order-history`        | 200, form. After signing in the shopper goes to `from` (a same-site path that is not an auth screen), else `/my-account`. An external `from` is dropped.                                                      |
| `/create-account`, `/forgot-password` | 200, forms, same `from` handling for their links.                                                                                                                                                             |

Every url answers `Cache-Control: no-store`.

## Rules in order

First match wins. This is the [phase 3 table](phase-3.md#rules-in-order) with four rows added above rule 12.

| #    | Request                                                               | Origin     | Methods    | Note                                                                       |
| ---- | --------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------------------------- |
| 1-3  | `/_next/static/*`, `/_next/image*`, `/images/layout/*`, `/robots.txt` | Next       | as phase 1 | Unchanged.                                                                 |
| 4    | `/healthz`                                                            | not public |            | Unchanged.                                                                 |
| 7-11 | Magento paths, products and CMS, `*.html`, `/`, home CMS page         | as phase 3 | as phase 3 | Unchanged.                                                                 |
| 12a  | `/cart` (exact) **new**                                               | Next       | all        | `POST` too: the cart page uses Server Actions.                             |
| 12b  | `/sign-in` (exact) **new**                                            | Next       | all        | Gated by the [social login decision](#decide-before-go-live-social-login). |
| 12c  | `/create-account` (exact) **new**                                     | Next       | all        | Same gate.                                                                 |
| 12d  | `/forgot-password` (exact) **new**                                    | Next       | all        |                                                                            |
| 12   | everything else                                                       | PWA        | as today   | Checkout, account, PWA assets.                                             |

Rules 12a-12d are exact matches, so `/cart/anything` and `/sign-in/foo` stay on PWA. Forward every query string untouched (`from`) and the headers of [phase 1](phase-1.md#headers-next-needs); **`X-Forwarded-Host` matters most here**, because every form submit is a Server Action `POST` to the page url and Next rejects it when the `Origin` host differs from the forwarded host.

## Session shared with PWA Studio

Both apps keep the session in the browser, so they must be served from **the same origin** (they are: one domain behind the edge):

- Token: `localStorage` key `M2_VENIA_BROWSER_PERSISTENCE__signin_token`, envelope `{value, timeStored, ttl}`, ttl 3600 s, the same as PWA Studio writes.
- Cart: key `M2_VENIA_BROWSER_PERSISTENCE__cartId`. Next sign-in merges the guest cart into the customer cart and stores the new id there.
- Sign-out on Next revokes the token (best effort), clears the token, the checkout data and the cart id, and reloads.

The edge only sees **full page loads**. Navigation inside the PWA single-page app (a link clicked in a PWA page) does not request the url from the edge, so a PWA page can keep showing the PWA version of these screens until the next full load. Links on Next pages are plain anchors, so they do reach the edge.

## CloudFront example

Add four behaviors to the Next origin, **above the default behavior** (PWA) and after the phase 3 behaviors, all with every HTTP method, `CachingDisabled` and `AllViewer`:

| Path pattern       |
| ------------------ |
| `/cart`            |
| `/sign-in`         |
| `/create-account`  |
| `/forgot-password` |

Check the behavior quota: phase 3 freed two, phase 4 uses four.

## nginx example

```nginx
    # Phase 4: exact locations, above the final `location /` (PWA).
    location = /cart              { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /sign-in           { proxy_buffering off; proxy_pass http://storefront_next; }   # gated: social login
    location = /create-account    { proxy_buffering off; proxy_pass http://storefront_next; }   # gated: social login
    location = /forgot-password   { proxy_buffering off; proxy_pass http://storefront_next; }
```

`location =` wins over the `\.html$` regex and the `/` prefix, so their position in the file does not matter.

## Prerender service

These urls are `noindex, nofollow` and need the shopper's browser storage, so a prerender copy is useless. Exclude them from the prerender service (and from any bot-only rule that sends crawlers to it). `robots.txt` does **not** disallow them on purpose: a disallowed url cannot show its `noindex` to a crawler.

## Caching

No caching. The pages are `force-dynamic` and answer `Cache-Control: no-store`; keep `CachingDisabled` (or nginx without `proxy_cache`). Never cache `POST` (Server Actions).

## Environment

| Variable               | Default | Effect                                                                                                                                                                          |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CART_REFRESH_BACKEND` | `false` | `true` makes the cart read `cp_price_change` and show the price-change and out-of-stock notices. Turn it on where Magento has the field (production does). Runtime, no rebuild. |

reCAPTCHA needs no variable: the screens read `recaptchaV3Config` from Magento and only send a token for the forms Magento lists.

## Rollback

PWA Studio still serves all four urls, so rollback is a routing change only: delete the four rules (CloudFront behaviors or nginx locations). Shoppers keep their session: the token and the cart id are in the PWA format, so a session started on Next should work on PWA and the other way around (the [checklist](#checklist) covers it).

## Not handled by the edge

| Item                                | Notes                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Social login                        | Not on the Next screens (see the decision above).                                                                        |
| Checkout, `/my-account/*`           | Stay on PWA. The account menu links there with full page loads.                                                          |
| "Descargar cotización" on the cart  | The legacy phone capture and guest sign-in prompt are not on the Next cart; the shopper downloads quotes from PWA pages. |
| Gift cards, coupon and gift options | Not on the Next cart summary.                                                                                            |

## Checklist

Run against the edge after the change. `B` is the public origin.

```sh
B=https://<public-domain>
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
code() { curl -s -o /dev/null -A "$UA" -w '%{http_code}\n' "$B$1"; }
vary() { curl -sI -A "$UA" "$B$1" | grep -i '^vary'; }

for p in /cart /sign-in /create-account /forgot-password; do code "$p"; vary "$p"; done   # 200, vary contains rsc
code /checkout          # PWA (no rsc in vary)
code /my-account        # PWA
code /cart/x            # PWA (exact rules)
```

- [ ] Each of the four urls answers 200 from Next (`Vary` contains `rsc`) and `noindex, nofollow`.
- [ ] A fresh browser on `/cart` shows "Tu carrito está vacío" and the header count at 0.
- [ ] Add a product on a Next product page, open `/cart`: the item is listed; "+" and "Eliminar" work and the header count follows.
- [ ] The summary shows Subtotal, Envío (estimate) and "Total estimado"; "Proceder al pago" reaches the PWA `/checkout` with the same cart.
- [ ] Sign in on Next, then open a PWA page (`/my-account`): the shopper is still signed in. Sign out on Next: the PWA shows a guest.
- [ ] Sign in with a guest cart: the guest items are in the customer cart.
- [ ] `/sign-in?from=/order-history` returns there after signing in; `?from=https://other.example` does not.
- [ ] Create account signs in; forgot password sends the email.
- [ ] A form submit succeeds through the edge (Server Action `POST` with the right `X-Forwarded-Host`).
- [ ] Production only: with `CART_REFRESH_BACKEND=true`, a cart with a changed price shows the notice and "Entendido".
- [ ] Prerender no longer receives these urls.

The same checks without the routing ones run as a read-only Playwright smoke (a fresh browser: no cart, no sign-in), and the whole cart flow runs on the local stack:

```sh
E2E_BASE_URL=$B E2E_PHASE4_SMOKE=1 pnpm test:e2e --project phase-4-smoke
pnpm test:e2e --project local        # cart page flow against mock Magento
```

## Next step

Phase 4 leaves checkout and the rest of the account on PWA. See the [phase 4 report](../phase-4-report.md).
