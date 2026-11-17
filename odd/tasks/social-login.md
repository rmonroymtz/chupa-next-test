# Social login on Next (Amasty Google and Facebook)

Objective: port the legacy Amasty social login (Google, Facebook) to the Next `/sign-in` and `/create-account`, and the "Cuenta vinculada con" notice to the profile edit, so the four phase 4 urls can move to Next. Branch `feat/social-login` (from `feat/phase-5-account`). Delivery: ask-on-risk. Runner: vitest (`pnpm test`), Playwright local stack (`pnpm test:e2e --project local`).

## Specs

- S1 Buttons. `/sign-in` and `/create-account` show the Magento social buttons (`amSocialLoginButtonConfig { type label url }`) under the form with the legacy separator "o", only when `storeConfig.amsociallogin_general_enabled` is true, `amsociallogin_general_login_position` lists `popup` and at least one button exists. Hidden otherwise, and when the config cannot be read. Staging (2026-11-17): Google and Facebook, position `popup` only.
- S2 Popup sign-in. A click opens `url + "&isAjax=true&generateToken=true"` in a 500×420 popup centered on the window (legacy `useSocButtons`). Magento answers the opener with `postMessage({ result, token, messages, redirect_data })`. On `result === 1` with a token: the server checks the token with Magento, creates the customer cart and merges the guest cart (the same steps as the password sign-in), the browser stores the session in the PWA format (`startSession`) and goes to `from` or `/my-account`, like the password sign-in.
- S3 Message trust (security, beyond the legacy). Only a message whose `event.source` is the popup this page opened and whose `event.origin` is the origin of the button url is read. Every other message is ignored. The legacy listener checks neither.
- S4 Errors. `result === 0`: the page shows `messages[0]`, or a generic error when there is none. Assumption: `redirect_data.redirectWithError` on `/sign-in` (legacy: switch to the create-account form) sends the browser to `/create-account` keeping `from`. A popup the browser blocks shows an error asking to allow pop-ups.
- S5 Linked accounts notice (user L3, phase 5 O3). On `/my-account/edit-account-information`, when `amSocialLoginAccountData { type name }` returns at least one account, the Security section shows, instead of the password status and "Cambiar contraseña", the legacy block: "Cuenta vinculada con {names joined with ' y '}", "Tu cuenta no tiene contraseña propia establecida. Podemos enviarte un correo para que crees una.", the button "Enviar correo de restablecimiento" ("Enviando..." while sending), on success "✓ Enviamos las instrucciones a {email}. Revisa tu bandeja de entrada y spam.", on failure "No pudimos enviar el correo. Intenta de nuevo.". The email is `requestPasswordResetEmail` with reCAPTCHA `CUSTOMER_FORGOT_PASSWORD`. When the list is empty or cannot be read, the page stays as it is.
- S6 Docs. Phase 4 routing and reports say social login is on Next and all four phase 4 rules can go live.

## Tasks

- [ ] T1 (S2, S3) Server side: gateway `getSocialLoginConfig` and `getLinkedSocialAccounts`, service `completeSocialSignIn` sharing the post-token steps of `signIn`, `getSocialLoginConfig`, `getLinkedSocialAccounts`, input schemas, Server Actions. Risk: item 2 (auth). Route: inline.
- [ ] T2 (S1-S4) `SocialButtons` client island on `/sign-in` and `/create-account`, popup and message domain. Risk: item 2 (accepting a sign-in token from another window). Route: inline.
- [ ] T3 (S5) Linked accounts notice on the profile edit. Risk: none. Route: inline.
- [ ] T4 (S6) Mock Magento, local e2e, routing doc and reports. Risk: none. Route: inline.

## Log

- L1 (2026-11-17) user: "Se pasan a nextjs con Google y Facebook" (decision on phase 4 O2, recorded in `odd/tasks/phase-4-customer-cart.md` L14).
- L2 (2026-11-17) legacy read (`chupaprecios-pwa` `src/@amasty/social-login`): buttons from `amSocialLoginButtonConfig`; `window.open(url + '&isAjax=true&generateToken=true', type, popup params)`; `useSignInEvent` listens to `message` on `window` without an origin check and, on `result === 1`, sets the token, creates the customer cart and merges the guest cart. Staging `storeConfig`: enabled, position `popup`, `redirect_type` 2.
- L3 (2026-11-17) user, on the "Cuenta vinculada con" notice: "Si incluyelo".
