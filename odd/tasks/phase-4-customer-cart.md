# Phase 4 storefront — customer session and cart page

Objective: Next writes the customer session (own sign-in, create-account, forgot-password screens) and serves `/cart`.
Branch: `feat/phase-4-customer-cart` (from `main`). Delivery: `ask-on-risk`. Runner: `pnpm typecheck && pnpm lint && pnpm test`,
`pnpm test:integration`, `pnpm build`.

## Specs

- S1 Scope (user): "cliente y carrito". Customer session + full cart page. Checkout and the rest of the account pages
  (`/my-account/*`) stay on the PWA.
- S2 Session ownership (user): "Si que la escriba nextjs con sus propias pantallas". Next writes the token with its own
  sign-in, create-account and forgot-password screens.
- S3 Assumption: keep the PWA storage format so both apps share one session: localStorage key
  `M2_VENIA_BROWSER_PERSISTENCE__signin_token`, envelope `{value, timeStored, ttl}`, ttl 3600 s (`domain/browser-persistence.ts`).
- S4 Sign-in parity with legacy (`useSignIn.js`): remember guest `sourceCartId` → `generateCustomerToken` → store token →
  `createEmptyCart` → `mergeCarts(source → destination)` → write destination `cartId` → load customer.
- S5 Sign-out parity (peregrine `asyncActions.js`): optional `revokeCustomerToken` (errors swallowed), clear token, clear
  checkout storage, forget `cartId`, refresh the page.
- S6 Header "Mi cuenta" reflects the session (today a static link to `/sign-in`).
- S7 `/cart` parity with the legacy `CartPage`: empty state "Tu carrito está vacío", heading "Mi carrito" / "Mi carrito + cotización"
  (`is_from_quote`), update quantity (`updateCartItems`), remove item, price summary (shipping estimate
  `chupaprecios_shipping_estimate`, free shipping threshold), quote badge and expiry banners, checkout button to the PWA.
- S8 Edge: new exact rules for `/cart`, `/sign-in`, `/create-account`, `/forgot-password` above rule 12 in a
  `docs/routing/phase-4.md`; the rest keeps going to the PWA.

## Open points (resolve before the task that needs them)

- O1 RESOLVED: reCAPTCHA is driven by Magento `recaptchaV3Config` (`website_key`, `badge_position`, `language_code`, `forms`: `CUSTOMER_LOGIN`, `CUSTOMER_CREATE`, `CUSTOMER_FORGOT_PASSWORD`); token goes in the `X-ReCaptcha` header, one token per Magento call. No env var needed; when the config is null or the form is not listed, no token is sent.
- O2 Amasty social login writes the token by its own route: OPEN. The Next `/sign-in` has no social buttons; decide before the edge change (T7) whether to port them or keep `/sign-in` on the PWA until then.
- O3 RESOLVED: `requestPasswordResetEmail(email)` (venia-ui `ForgotPassword/forgotPassword.gql.js`).
- O4 `cp_price_change` is behind a build-time PWA flag `CHUPAPRECIOS_CART_REFRESH_BACKEND`: Next needs a runtime flag (T6).
- O5 Expired or rejected token (Magento 401 before the 1 h ttl): needs a not-authorized path in the gateway (T2).
- O6 Check `useCartPage` redirect behavior and CHUP-redesign differences (T5).

## Tasks

- [x] T1 (S3) Session storage: `PwaCartStorage` gains `writeSigninToken` (ttl 3600), `clearSigninToken`, `clearCartId`; `KeyValueStorage.removeItem`. Route: inline. RED 3 failed, GREEN unit all pass, typecheck/lint ok. Commit: see log.
- [x] T2 (S3, O5) New module `src/modules/customer`: `CustomerGateway` port (signIn, getCustomer, mergeCarts, revokeToken), Magento adapter, error kinds `invalid_credentials | not_authorized | failure` (O5 resolved). createAccount and forgot-password land in T3 (O3). Route: inline. RED: suite failed to load (module missing); GREEN 8 tests, full checks ok.
- [ ] T3a (S2, S4, O1, O3) Server side of the auth flows: customer gateway (createAccount, requestPasswordReset, reCAPTCHA config), `CustomerService` (sign-in with cart + merge, create account, reset, sign-out), input schemas, Server Actions. Risk: item 2 (auth). Route: inline. Commits: gateway `c7c7c54`; service + actions in the T3a commit. RED observed for gateway and service; the actions test was written with the code (no RED). Native review (risk + resilience lenses, base `6f086c1`): approved and acknowledged, 4 non-blocking warnings (see L4).
- [x] T3b (S2, O1, O2) Screens `/sign-in`, `/create-account`, `/forgot-password` (noindex, `?from=` redirect like the PWA `history.state.from`, defaults `/my-account` and `/order-history`), reCAPTCHA hook driven by `recaptchaV3Config`, session write via `startSession`, `SignIn` metric outcome `degraded` (L4d). Risk: item 2. Tests: 41 customer unit tests added; the UI/domain tests were written with the code (no RED, except `auth-forms` domain). Build ok. Not covered: social login (O2, still open), e2e smoke (T7).
- [x] T4 (S5, S6) Header session state and sign-out: `AccountAction` island (sign-in link for guests; account menu with name, email, the 7 legacy items and "Cerrar sesión" once Magento answers), `getCustomer` service/action, `clearCheckoutData` in `PwaCartStorage`. Sign-out: revoke best effort, clear token, checkout data and cart id, reload. Risk: item 2. RED observed for storage and service/action; the island and domain tests were written with the code. 1273 unit tests, lint/typecheck ok. Not covered: social login logout (O2); visual check of the dropdown (user).
- [ ] T5 (S7, O6) Cart page: read model, list, empty state, update qty, remove.
- [ ] T6 (S7, O4) Price summary, shipping estimate, quotes banners, checkout button.
- [ ] T7 (S8) Routing docs, e2e smoke, phase-4 report.

## Log

- L1 (2026-10-28) user: "arrancamos con la fase 4" → "vamos por cliente y carrito" → "Si que la escriba nextjs con sus propias pantallas".
- L2 (2026-10-28): mapping done by a read-only explorer (legacy PWA `~/Proyectos/chupaprecios-pwa`, Next `src/modules/cart`).
  Findings feed S3–S8 and O1–O6. Next today only reads the token; the cart module is mini-cart only (create, add, count,
  mini-cart, remove) behind Server Actions; header account is a static `<a>` to `/sign-in`.
- L3 (2026-10-28) user: "lo puedes revisar en el proyecto de pwa-studio ahi esta lo que usa nativamente pwa-stuidio y magento" → O1/O3 resolved from `~/Proyectos/pwa-studio` (`useGoogleReCaptcha`, `ForgotPassword`).
- L4 (2026-10-28): native review of T2+T3a approved (lenses risk, resilience; user granted consent). Advisory follow-ups, not blockers: (a) no rate limiting on the public auth Server Actions, relies on Magento lock + reCAPTCHA; (b) reCAPTCHA token is client-supplied and optional, enforcement depends on Magento config; (c) `getRecaptchaConfig` is uncached and a Magento failure is swallowed with no log/metric; (d) sign-in emits `signed_in` even when cart creation or merge degraded, and the browser drops the guest cart id, so guest items can be lost silently: add a degraded-outcome metric and decide in T3b whether to keep the guest cart id when the merge fails.
- L5 (2026-10-28): T3b implemented. Simplifications vs legacy: no password requirements block on the sign-in screen; the reCAPTCHA `inline` badge is rendered by key like the other badges; redirect target is the `?from=` query (validated same-site path, never an auth screen) instead of `history.state`.
- L6 (2026-10-28): native review of T3b (lenses risk, resilience, reliability; user granted consent) approved and acknowledged; 6 advisory warnings. Fixed right after (not re-reviewed, advisory only): reCAPTCHA config no longer cached when missing/failed; script load gives up after 5 s; create-account no longer offers to recreate an existing account when the second step throws (tests added, RED observed). Still open: the guest cart id is replaced or dropped when the merge degrades (the metric reports it, the browser is not told). Fix needs `SignInResult` to carry a `merged` flag so `startSession` can keep the guest cart id; decide in T5 with the cart page.
- L7 (2026-10-28): native review of T4 (base `1d72045`, lenses risk, resilience, reliability; user granted consent) approved and acknowledged; 6 advisory warnings. Fixed: sign-out no longer waits forever on a stalled revoke (3 s race, test added). Open follow-ups: (a) sign-out ignores `false` returns when storage is unavailable; (b) the header reads the session only on mount, stale after a sign-in/out in another tab or token expiry; a failed customer read shows the menu with a possibly expired token; (c) one uncached `getCustomer` per page load for signed-in shoppers, no metric/backoff; (d) after the 5 s reCAPTCHA timeout the script tag stays in the DOM and a retry appends a second one.
- L8 (2026-10-28) user: sent a mockup of the sign-in screen (`~/Descargas/Frame.png`) and asked to update styles and layout. Done for the card, subtitle, labels/placeholders, mail and lock icons, eye toggle, red forgot link, pill button with arrow, create-account line and help links (Ayuda, Términos y condiciones, Aviso de privacidad, from the site footer hrefs). NOT built, pending the user: Google/Facebook buttons with the "o continúa con" divider (social login is O2 and needs a decision), "Recordarme" (the token ttl is fixed at 1 h, so it would do nothing), and the B2B banner (target url unknown). Create-account and forgot-password got the same card shell only.
