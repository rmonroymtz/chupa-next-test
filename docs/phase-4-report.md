# Phase 4 report: customer session and cart page on Next.js

Phase 4 makes the Next.js storefront own **the customer session** (its own sign-in, create-account and forgot-password screens, header account menu and sign-out) and **the cart page (`/cart`)**. The session uses the PWA Studio storage format, so both apps share one session and one cart. Checkout and the rest of the account stay on PWA Studio. The work is on branch `feat/phase-4-customer-cart`; go-live is the edge change in [`docs/routing/phase-4.md`](routing/phase-4.md) plus the pending items below.

## At a glance

| Area                                                                         | Status                        |
| ---------------------------------------------------------------------------- | ----------------------------- |
| Session storage in the PWA format (token, cart id, checkout data)            | Done (T1)                     |
| Customer module: gateway, service, Server Actions, reCAPTCHA                 | Done (T2, T3a)                |
| Sign-in, create-account, forgot-password screens, restyled to the new design | Done (T3b)                    |
| Header account menu and sign-out                                             | Done (T4)                     |
| Cart page: list, quantity, remove, empty state                               | Done (T5)                     |
| Price summary, shipping estimate, free shipping message, checkout link       | Done (T6a)                    |
| Quote badge, expired-quote banner and modal, price-change notices            | Done (T6b)                    |
| Edge routing doc, report, env docs, e2e (local flow and remote smoke)        | Done (T7)                     |
| Social login (Google, Facebook) on the Next screens                          | **Not built** (decision open) |
| Edge change and real-environment checks                                      | Pending (see below)           |

## What was built

| Task | Commits                         | What it does                                                                                                                                                                                                                             |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | `6f086c1`                       | `PwaCartStorage` writes and clears the sign-in token (ttl 3600 s), the cart id and the checkout data in the PWA `localStorage` envelope.                                                                                                 |
| T2   | `a8d50b2`                       | `src/modules/customer`: `CustomerGateway` port and Magento adapter (`generateCustomerToken`, customer read, `mergeCarts`, token revoke); error kinds `invalid_credentials`, `not_authorized`, `failure`.                                 |
| T3a  | `c7c7c54`, `d8034c1`            | Account creation, password reset email and `recaptchaV3Config` in the gateway; `CustomerService` (sign-in with cart creation and merge, create account, reset, sign-out); input schemas and Server Actions.                              |
| T3b  | `1d72045`, `fda8ecd`, `346517d` | The three screens (`noindex`), `?from=` redirect (same-site path only), reCAPTCHA hook driven by Magento's config, session write through `startSession`, `SignIn` metric with a `degraded` outcome; restyled to the new login mockup.    |
| T4   | `0170a25`, `f8efc16`            | `AccountAction` island: sign-in link for guests, account menu (name, email, the legacy items, "Cerrar sesión") for signed-in shoppers. Sign-out revokes best effort (3 s race), clears token, checkout data and cart id, reloads.        |
| T5   | `5ff3b6e`, `0782fc4`            | `/cart`: `GetCartDetails`, `updateItemQuantity`, `removeItem` behind Server Actions; client island with empty state, error and retry, regular and quote sections, quantity stepper, "Eliminar", out-of-stock message, header count sync. |
| T6a  | `c91c2ca`                       | Price summary (subtotal, discounts, taxes, shipping, "Total estimado"), `chupaprecios_shipping_estimate` and `free_shipping_subtotal` read after every change, checkout link to the PWA.                                                 |
| T6b  | `8d5f518`, `034b70c`            | Quote badge, expired-quote banner and confirmation modal (`refreshExpiredQuoteCartItemPrices`), price-change and out-of-stock notices (`cp_price_change`, `acknowledgeCartPriceChanges`) behind `CART_REFRESH_BACKEND`.                  |
| T7   | this commit                     | [Phase 4 routing](routing/phase-4.md), this report, env docs, `e2e/local/cart-page.spec.ts`, `e2e/phase-4-smoke.spec.ts`, mock Magento support for the cart page.                                                                        |

## Key decisions

Numbers refer to the specs and open points in `odd/tasks/phase-4-customer-cart.md`.

| #   | Decision                                                                                                                                                   | Legacy parity                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| S2  | Next writes the session with its own screens (not a handoff to PWA).                                                                                       | Same flow: `generateCustomerToken`, `createEmptyCart`, `mergeCarts`, store token and cart id (`useSignIn.js`). |
| S3  | Keep the PWA storage format: key `M2_VENIA_BROWSER_PERSISTENCE__signin_token`, envelope `{value, timeStored, ttl}`, ttl 3600 s.                            | Identical, so a session started on either app is read by the other.                                            |
| O1  | reCAPTCHA follows Magento's `recaptchaV3Config` (token in `X-ReCaptcha`, one per call); nothing is sent when the form is not listed.                       | Same source as PWA Studio (`useGoogleReCaptcha`).                                                              |
| O4  | `cp_price_change` behind a runtime switch, `CART_REFRESH_BACKEND` (default off).                                                                           | **Differs**: the legacy flag is a build-time variable (`CHUPAPRECIOS_CART_REFRESH_BACKEND`).                   |
| O5  | A token Magento rejects before the 1 h ttl (401) is a `not_authorized` error in the gateway.                                                               | New in Next: the session is read from the shared storage, so an expired or revoked token has to be recognized. |
| O6  | The cart page does not redirect: an empty or rejected cart is the empty state.                                                                             | Same as `useCartPage`; the cart page files are identical on `CHUP-redesign`.                                   |
| –   | The cart is read in the browser through Server Actions (cart id and token live in `localStorage`); a cart Magento rejects is never recreated on the page.  | Legacy read it with Apollo in the browser too.                                                                 |
| –   | The shipping estimate and the free shipping threshold are one best-effort query after each read or change; without them the page shows the summary it has. | Legacy refetched the estimate when the subtotal changed.                                                       |

## Differences from the legacy PWA

| Area                 | Legacy PWA                                                                     | Next                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in redirect     | `history.state.from`                                                           | `?from=` query, validated same-site path, never an auth screen.                                                                         |
| Sign-in screen       | Social login, password requirements block                                      | Email and password only; no password requirements block; no "Recordarme" (the ttl is fixed at 1 h); no B2B banner (target url unknown). |
| Quantity             | Stepper that removes the item at 0                                             | Never below 1; "Eliminar" is the only removal.                                                                                          |
| Price column         | Unit price shown twice                                                         | Once.                                                                                                                                   |
| Item image           | Configurable variant image                                                     | `small_image`, else `thumbnail`.                                                                                                        |
| Summary              | Gift cards, gift options, per-discount expander, "FREE", "Proceed to Checkout" | None of the first three; "Gratis" and "Proceder al pago".                                                                               |
| Quotes               | "Descargar cotización" with phone capture and guest prompt; toasts             | Not on the Next cart (stays on PWA pages); the renewal result is an inline status line.                                                 |
| Quote badge button   | "Actualizar precio" on an expired badge (only where `onRefresh` is passed)     | Not built: the cart does not pass it either; the banner opens the modal.                                                                |
| Wishlist, edit modal | On each cart row                                                               | Not built. No GTM events from the cart page.                                                                                            |
| Header account       | Static link until the PWA loads                                                | Reads the session from the PWA storage and shows the menu once Magento answers.                                                         |

## Verification

| Check                                                 | Result                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (Vitest)                                   | 1368 (1273 after T4, 1316 after T5, 1334 after T6a)                                                                                                                                                                                           |
| Integration (real server, mock Magento and CHAPI)     | 102, unchanged by the mock Magento extensions of T7                                                                                                                                                                                           |
| `typecheck`, `lint`, `build`                          | Green on every task (one existing lint warning in `product-page-service.test.ts`)                                                                                                                                                             |
| `pnpm test:e2e --project local`                       | 9 passed (2026-11-02): the cart page flow (add on the PDP, list, "+", summary with estimate and threshold, reload, remove) and the auth screens (200, noindex, `Vary: rsc`, `no-store`, `from` handling), plus the existing shared-cart specs |
| `e2e/phase-4-smoke.spec.ts` (against the local stack) | 7 passed (2026-11-02), run through a temporary copy that pointed at the local stack; not yet run against staging or an edge                                                                                                                   |
| Native review                                         | T2+T3a, T3b and T4 reviewed and approved (see below). T5 to T7: `assess` answered medium, `under_budget`, no review due                                                                                                                       |
| Manual sign-in (user, `next dev` against staging)     | Sign-in works, token ttl 1 h, customer returned, guest cart product stayed in the cart (merge verified)                                                                                                                                       |

### Native review follow-ups (advisory, not blockers)

| Item                                                            | Notes                                                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No rate limiting on the public auth Server Actions              | Relies on Magento's lock and reCAPTCHA (T3a).                                                                                                                                              |
| reCAPTCHA token is client-supplied and optional                 | Enforcement depends on the Magento config. On staging the token was `null` and Magento accepted the sign-in, so it is not enforced for `CUSTOMER_LOGIN` there. Check production's `forms`. |
| Guest cart id lost when the sign-in merge degrades              | The metric reports `degraded`, the browser is not told. The fix needs a `merged` flag in `SignInResult` so `startSession` keeps the guest cart id.                                         |
| `getRecaptchaConfig` has no cache or log of a Magento failure   | The config is no longer cached when missing or failed (fixed in T3b); a failure is still silent.                                                                                           |
| Sign-out ignores `false` returns when storage is unavailable    | T4 review.                                                                                                                                                                                 |
| The header reads the session only on mount                      | Stale after a sign-in or sign-out in another tab or after the token expires; a failed customer read shows the menu with a possibly expired token.                                          |
| One uncached `getCustomer` per page load for signed-in shoppers | No metric or backoff.                                                                                                                                                                      |
| After the 5 s reCAPTCHA timeout the script tag stays in the DOM | A retry appends a second one.                                                                                                                                                              |
| Expired-prices modal state                                      | `modalOpen` stays true when the expired list empties by another change; a later expired item would reopen the modal.                                                                       |

## Pending before go-live

- [ ] **Decide social login** (see [phase 4 routing](routing/phase-4.md#decide-before-go-live-social-login)): option A routes all four urls, option B only `/cart` and `/forgot-password`.
- [ ] **Edge change** ([phase 4 routing](routing/phase-4.md)): add the rules, exclude the urls from prerender, run its checklist.
- [ ] **Staging run of `/cart`**: the quote fields, `refreshExpiredQuoteCartItemPrices`, `chupaprecios_shipping_estimate` and `free_shipping_subtotal` come from the legacy documents and have only run against the mock.
- [ ] **`CART_REFRESH_BACKEND=true`** in the production task definition (the PWA flag is on there); confirm `cp_price_change` on staging before turning it on there.
- [ ] **Manual checks by a person** not covered yet: the PWA staying signed in after a Next sign-in, the header menu and sign-out, create account, forgot password, and the visual check of the cart page, the expired-prices modal and the notices.
- [ ] **`.env.example`**: add `CART_REFRESH_BACKEND=false` and `E2E_PHASE4_SMOKE` as in [`docs/environment.md`](environment.md) (the agent could not edit that file).
- [ ] Run `e2e/phase-4-smoke.spec.ts` against staging behind the edge (`E2E_PHASE4_SMOKE=1`).

## Known limitations and follow-ups

| Item                                 | Notes                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Social login                         | Not built; needs a decision on porting the Amasty flow or keeping `/sign-in` on PWA.                                |
| No cart page GTM events              | The legacy `CART_PAGE_VIEW`, `CART_REMOVE_ITEM` and quote CTA events are not sent from Next.                        |
| The order total ignores hidden items | As in the PWA, hidden out-of-stock items leave the Subtotal but not Magento's `grand_total`.                        |
| Quote date format                    | The badge shows the date part of `quote_expiration_date` as Magento sends it (`YYYY-MM-DD`), like the legacy badge. |
| No cache                             | Every cart read is a Magento call plus one extras call (estimate, threshold); a change adds a second call.          |

## Next step

Apply the edge change in [phase 4 routing](routing/phase-4.md) on staging (after phase 3), run its checklist and the phase 4 smoke, then production. With the cart and the session on Next, what the edge still sends to PWA is checkout and the account pages.
