# Phase 5 routing: the basic account moves to Next

Phase 5 sends **the basic account pages** (`/my-account`, the profile, the address book, support), **the five legacy account aliases** and **the reset-password link target** (`/customer/account/createPassword`) to the Next.js storefront. With the [phase 4 rules](phase-4.md) live, that is a set of **exact rules above the PWA default rule**. Everything else in the account (orders, quotes, saved cards, billing and invoices), checkout and the rest of PWA Studio keeps going to the PWA. Rolling back means deleting the new rules.

This document is for whoever operates the edge (CloudFront or nginx). The configs are **examples to adapt**, not drop-in files.

## Before go-live

- **Phase 4 session.** The account pages read the sign-in token from the PWA `localStorage` (see [Session shared with PWA Studio](phase-4.md#session-shared-with-pwa-studio)), so a session started on PWA Studio or on Next works. The phase 4 edge rules are not required, but see the note on `from` below.
- **Google Places (New).** The address form suggests addresses with the **new** Google Places API, using the key Magento already stores for the checkout (`amasty_checkout_geolocation_google_api_key`). In the Google Cloud project of that key:
  1. enable **Places API (New)** (a separate service from the legacy "Places API"; the first test against staging answered `SERVICE_DISABLED` for the project of the key);
  2. if the key has API restrictions, allow **Places API (New)**;
  3. if it has website (HTTP referrer) restrictions, add the staging and production domains.
     Without this the address form still works: the street is a plain input and no error is shown.
- **Magento fields.** The profile reads the customer fields `middlename`, `social_profile_photo` and `phone_number` (the legacy reads them too). If a Magento lacks one, the account pages show "Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo." Check on staging first.
- **reCAPTCHA.** No variable: the pages read `recaptchaV3Config`. A password change sends a token only if Magento lists the form `CUSTOMER_EDIT`.

## Quick path

1. Add the rules of the [table below](#rules-in-order) above the default (everything else → PWA) rule.
2. Exclude these urls from the prerender service (see [Prerender](#prerender-service)).
3. Run the [checklist](#checklist) and the phase 5 smoke, then watch `ProfileUpdate`, `AddressChange`, `PasswordReset` and 5xx rates on Next for a day.

## What changes

| Request                                                                                  | Phase 4 | Phase 5 | Why                                                                              |
| ---------------------------------------------------------------------------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `/my-account`                                                                            | PWA     | Next    | Dashboard: greeting, avatar, six cards.                                          |
| `/my-account/account-information`, `/my-account/edit-account-information`                | PWA     | Next    | Profile view and edit (name, email, phone, password).                            |
| `/my-account/address-book`, `/new`, `/edit/{id}`                                         | PWA     | Next    | Address list with delete, and the config-driven form with Google suggestions.    |
| `/my-account/support`                                                                    | PWA     | Next    | Static contact page.                                                             |
| `/order-history`, `/account-information`, `/address-book`, `/saved-payments`, `/quotes`  | PWA     | Next    | Legacy aliases: Next answers a 307 to `/my-account` + the same path, query kept. |
| `/customer/account/createPassword?token=…`                                               | PWA     | Next    | The link in Magento's reset-password email.                                      |
| `/my-account/order-history`, `/quotes`, `/saved-payments`, billing and invoice pages     | PWA     | PWA     | Not migrated (the next phases).                                                  |
| `/checkout`, `/kueski/*`, `/facturacion`, `/social-accounts`, `/contact-us`, `/wishlist` | PWA     | PWA     | Unchanged.                                                                       |
| Everything from phases 1-4                                                               | Next    | Next    | Unchanged.                                                                       |

### What Next answers

| Url                                 | Answer                                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any account page, as a guest        | 200, `noindex, nofollow`, `Vary: rsc`, `Cache-Control: no-store`. The session is in the browser, so the browser then goes to `/sign-in?from=<the page>`.                                  |
| Any account page, signed in         | The page, after the profile is read. A token Magento rejects is dropped and the shopper goes to sign in.                                                                                  |
| `/order-history?x=1` (any alias)    | 307 to `/my-account/order-history?x=1`. Temporary on purpose: a browser must not cache the hop if the edge sends the aliases back to the PWA.                                             |
| `/my-account/address-book/edit/abc` | 200 with "No encontramos esta dirección." (the same as an address that does not exist). There is no real 404: under the account layout the status is sent before the check.               |
| `/customer/account/createPassword`  | 200, `noindex, nofollow`, `referrer: no-referrer`. Without `?token=` the legacy error "Uh oh, algo salió mal. Verifica el enlace o inténtalo de nuevo." and a link to `/forgot-password`. |

## Rules in order

First match wins. This is the [phase 4 table](phase-4.md#rules-in-order) with the rows below added above the default rule (12), after the phase 4 rows.

| #   | Request                                                                                                 | Origin | Methods  | Note                                                        |
| --- | ------------------------------------------------------------------------------------------------------- | ------ | -------- | ----------------------------------------------------------- |
| 12e | `/my-account` (exact) **new**                                                                           | Next   | all      | Server Actions `POST` to the page url.                      |
| 12f | `/my-account/account-information` (exact) **new**                                                       | Next   | all      |                                                             |
| 12g | `/my-account/edit-account-information` (exact) **new**                                                  | Next   | all      |                                                             |
| 12h | `/my-account/address-book` (exact) **new**                                                              | Next   | all      |                                                             |
| 12i | `/my-account/address-book/new` (exact) **new**                                                          | Next   | all      |                                                             |
| 12j | `/my-account/address-book/edit/{digits}` **new**                                                        | Next   | all      | One segment of digits (the id).                             |
| 12k | `/my-account/support` (exact) **new**                                                                   | Next   | all      |                                                             |
| 12l | `/order-history`, `/account-information`, `/address-book`, `/saved-payments`, `/quotes` (exact) **new** | Next   | GET      | See [The alias hop](#the-alias-hop).                        |
| 12m | `/customer/account/createPassword` (exact) **new**                                                      | Next   | all      | The query string (`token`) must reach Next untouched.       |
| 12  | everything else                                                                                         | PWA    | as today | Orders, quotes, saved cards, billing, checkout, PWA assets. |

The rules are exact, so `/my-account/order-history` and any other `/my-account/...` url not listed stays on PWA. Forward every query string untouched and the headers of [phase 1](phase-1.md#headers-next-needs); **`X-Forwarded-Host` matters most here**, because every form submit is a Server Action `POST` to the page url and Next rejects it when the `Origin` host differs from the forwarded host.

### The alias hop

`/order-history`, `/saved-payments` and `/quotes` lead to pages that are still on the PWA: Next answers the 307 and the browser asks for `/my-account/order-history` again, which the edge sends to the PWA. That costs one extra request. If you prefer, **leave those three aliases on the PWA** (it redirects them inside its own app) and route only `/account-information` and `/address-book`. Both options work.

### The sign-in `from`

A guest on an account page is sent to `/sign-in?from=<page>`. The Next sign-in returns the shopper to that page. The PWA sign-in stores the same value in its router state but nothing reads it, so with `/sign-in` still on the PWA (option B of the [phase 4 decision](phase-4.md#decide-before-go-live-social-login)) the shopper lands on the PWA default page after signing in and has to open the account page again.

## CloudFront example

Add these behaviors to the Next origin, **above the default behavior** (PWA) and after the phase 4 behaviors, all with `CachingDisabled` and `AllViewer`. All methods, except the aliases (GET and HEAD are enough):

| Path pattern                           |
| -------------------------------------- |
| `/my-account`                          |
| `/my-account/account-information`      |
| `/my-account/edit-account-information` |
| `/my-account/address-book`             |
| `/my-account/address-book/new`         |
| `/my-account/address-book/edit/*`      |
| `/my-account/support`                  |
| `/order-history`                       |
| `/account-information`                 |
| `/address-book`                        |
| `/saved-payments`                      |
| `/quotes`                              |
| `/customer/account/createPassword`     |

That is 13 behaviors (10 if the three PWA-bound aliases stay on the PWA): check the quota. `/my-account/address-book/edit/*` also matches deeper paths (`/edit/1/x`), which get Next's 404 page.

## nginx example

```nginx
    # Phase 5: exact locations, above the final `location /` (PWA).
    location = /my-account                          { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /my-account/account-information      { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /my-account/edit-account-information { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /my-account/address-book             { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /my-account/address-book/new         { proxy_buffering off; proxy_pass http://storefront_next; }
    location ~ ^/my-account/address-book/edit/\d+$  { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /my-account/support                  { proxy_buffering off; proxy_pass http://storefront_next; }
    location = /customer/account/createPassword     { proxy_buffering off; proxy_pass http://storefront_next; }
    # Legacy aliases (see "The alias hop").
    location ~ ^/(order-history|account-information|address-book|saved-payments|quotes)$ {
        proxy_pass http://storefront_next;
    }
```

`location =` and the anchored regexes win over the `\.html$` regex and the `/` prefix, so their position in the file does not matter. `location =` ignores the query string, so `?token=` reaches Next.

## Prerender service

These urls are `noindex, nofollow` and need the shopper's browser storage, so a prerender copy is useless. Exclude them from the prerender service (and from any bot-only rule that sends crawlers to it). `robots.txt` keeps `Disallow: /customer/` and does not list `/my-account` or the aliases; do not add them: a disallowed url cannot show its `noindex`.

## Caching

No caching. The pages are `force-dynamic` and answer `Cache-Control: no-store`; keep `CachingDisabled` (or nginx without `proxy_cache`). Never cache `POST` (Server Actions), and never cache the reset-password page: its url carries a secret token.

## Rollback

PWA Studio still serves every one of these urls, so rollback is a routing change only: delete the new rules. Nothing is stored in Next: the session and the addresses are Magento's, and the token is in the PWA format, so a session started on either app works on the other.

## Not handled by the edge

| Item                                             | Notes                                                                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders, quotes, saved cards, billing, invoices   | Still PWA pages, linked from the dashboard with full page loads.                                                                                                 |
| "DIRECCIONES DE FACTURACIÓN" in the address book | The legacy section with the RFC and CFDI data belongs to the billing phase and is not on the Next address book.                                                  |
| Social accounts on the profile edit              | The legacy "Cuenta vinculada con …" block (Amasty social login) is not built; it depends on the social login decision of phase 4.                                |
| Chat identity                                    | `window.ChupaChat` is loaded by GTM and the support buttons open it, but Next does not call `identify`/`clear`: the chat starts anonymous until a PWA page runs. |

## Checklist

Run against the edge after the change. `B` is the public origin.

```sh
B=https://<public-domain>
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
code() { curl -s -o /dev/null -A "$UA" -w '%{http_code} %{redirect_url}\n' "$B$1"; }
vary() { curl -sI -A "$UA" "$B$1" | grep -i '^vary'; }

for p in /my-account /my-account/account-information /my-account/edit-account-information \
         /my-account/address-book /my-account/address-book/new /my-account/address-book/edit/1 \
         /my-account/support /customer/account/createPassword; do code "$p"; vary "$p"; done  # 200, vary has rsc
for p in /order-history /account-information /address-book /saved-payments /quotes; do code "$p?x=1"; done  # 307 $B/my-account/...?x=1
code /my-account/order-history   # PWA (no rsc in vary)
code /my-account/quotes          # PWA
```

- [ ] Each migrated url answers 200 from Next (`Vary` contains `rsc`) and `noindex, nofollow`.
- [ ] A guest on `/my-account` ends on `/sign-in?from=%2Fmy-account`.
- [ ] Signed in: the dashboard shows the greeting, the avatar and the six cards; the breadcrumb and the cards link to PWA pages with full loads.
- [ ] Profile: change the phone; change the name; change the email (needs the Seguridad section and the current password); change the password. A wrong current password shows "La contraseña actual no es correcta.".
- [ ] After a password change, check whether Magento revoked the token (the next page load goes to sign-in) and whether the PWA still sees the session.
- [ ] Address book: the list sorts the default address first with "Principal"; add, edit by card and by direct url, and delete a non-default address.
- [ ] The form fields match the Amasty config (labels, order, required) and the region is a select of Mexican states.
- [ ] Address suggestions: after three characters, suggestions appear; picking one fills street, number, colonia, postal code, city and state, and then the municipio. (If nothing appears, the Google key still lacks Places API (New) or the referrer.)
- [ ] The aliases redirect and keep the query (`/order-history?callbackUrl=%2Fcheckout`).
- [ ] The reset-password email link opens `/customer/account/createPassword?token=…` on Next, saves the new password and shows the confirmation; a link used twice or expired shows "El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo.".
- [ ] A form submit succeeds through the edge (Server Action `POST` with the right `X-Forwarded-Host`).
- [ ] Prerender no longer receives these urls.

The same checks without the routing ones and without a session run as a read-only Playwright smoke, and the whole account flow runs on the local stack:

```sh
E2E_BASE_URL=$B E2E_PHASE5_SMOKE=1 pnpm test:e2e --project phase-5-smoke
pnpm test:e2e --project local        # account flow against mock Magento
```

## Next step

Phase 5 leaves orders, quotes, saved cards, billing and the checkout on the PWA. See the [phase 5 report](../phase-5-report.md).
