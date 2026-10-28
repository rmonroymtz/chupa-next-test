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
- O2 Amasty social login writes the token by its own route: decide keep on PWA or port (T3).
- O3 RESOLVED: `requestPasswordResetEmail(email)` (venia-ui `ForgotPassword/forgotPassword.gql.js`).
- O4 `cp_price_change` is behind a build-time PWA flag `CHUPAPRECIOS_CART_REFRESH_BACKEND`: Next needs a runtime flag (T6).
- O5 Expired or rejected token (Magento 401 before the 1 h ttl): needs a not-authorized path in the gateway (T2).
- O6 Check `useCartPage` redirect behavior and CHUP-redesign differences (T5).

## Tasks

- [x] T1 (S3) Session storage: `PwaCartStorage` gains `writeSigninToken` (ttl 3600), `clearSigninToken`, `clearCartId`; `KeyValueStorage.removeItem`. Route: inline. RED 3 failed, GREEN unit all pass, typecheck/lint ok. Commit: see log.
- [x] T2 (S3, O5) New module `src/modules/customer`: `CustomerGateway` port (signIn, getCustomer, mergeCarts, revokeToken), Magento adapter, error kinds `invalid_credentials | not_authorized | failure` (O5 resolved). createAccount and forgot-password land in T3 (O3). Route: inline. RED: suite failed to load (module missing); GREEN 8 tests, full checks ok.
- [ ] T3a (S2, S4, O1, O3) Server side of the auth flows: customer gateway (createAccount, requestPasswordReset, reCAPTCHA config), `CustomerService` (sign-in with cart + merge, create account, reset, sign-out), input schemas, Server Actions. Risk: item 2 (auth). Route: inline. Commits: gateway `c7c7c54`; service + actions in the T3a commit. RED observed for gateway and service; the actions test was written with the code (no RED).
- [ ] T3b (S2, O1, O2) Screens `/sign-in`, `/create-account`, `/forgot-password`, reCAPTCHA loading driven by `recaptchaV3Config`, session write in the browser (token + cart id). Risk: item 2.
- [ ] T4 (S5, S6) Sign-out and header session state. Risk: item 2.
- [ ] T5 (S7, O6) Cart page: read model, list, empty state, update qty, remove.
- [ ] T6 (S7, O4) Price summary, shipping estimate, quotes banners, checkout button.
- [ ] T7 (S8) Routing docs, e2e smoke, phase-4 report.

## Log

- L1 (2026-10-28) user: "arrancamos con la fase 4" → "vamos por cliente y carrito" → "Si que la escriba nextjs con sus propias pantallas".
- L2 (2026-10-28): mapping done by a read-only explorer (legacy PWA `~/Proyectos/chupaprecios-pwa`, Next `src/modules/cart`).
  Findings feed S3–S8 and O1–O6. Next today only reads the token; the cart module is mini-cart only (create, add, count,
  mini-cart, remove) behind Server Actions; header account is a static `<a>` to `/sign-in`.
- L3 (2026-10-28) user: "lo puedes revisar en el proyecto de pwa-studio ahi esta lo que usa nativamente pwa-stuidio y magento" → O1/O3 resolved from `~/Proyectos/pwa-studio` (`useGoogleReCaptcha`, `ForgotPassword`).
