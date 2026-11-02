# Phase 5 report: the basic account on Next.js

Phase 5 makes the Next.js storefront serve **the basic account area**: the dashboard (`/my-account`), the profile (view and edit, with password change), the address book (list, new, edit, delete, with Google suggestions), the support page, the five legacy account aliases and the reset-password link target (`/customer/account/createPassword`). It reuses the phase 4 session (the PWA storage format), so both apps share one login. Orders, quotes, saved cards, billing and invoices, and the checkout stay on PWA Studio. The work is on branch `feat/phase-5-account`; go-live is the edge change in [`docs/routing/phase-5.md`](routing/phase-5.md) plus the pending items below.

## At a glance

| Area                                                                           | Status                                 |
| ------------------------------------------------------------------------------ | -------------------------------------- |
| Account guard, dashboard, breadcrumb, support page, legacy aliases             | Done (T1)                              |
| Profile view and edit: phone, name and email, password                         | Done (T2)                              |
| Reset-password link page                                                       | Done (T3)                              |
| Address book: list, delete, new and edit form from the Amasty config           | Done (T4a-T4c)                         |
| Address suggestions on the new Google Places API, SEPOMEX municipio            | Done (T4d), not run against Google yet |
| Edge routing doc, report, env docs, e2e (local flow and remote smoke)          | Done (T5)                              |
| Orders, quotes, saved cards, billing and invoices                              | **Not in this phase** (PWA)            |
| Social accounts block on the profile edit, billing section in the address book | **Not built**                          |
| Edge change and real-environment checks                                        | Pending (see below)                    |

## What was built

| Task | Commits              | What it does                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | `8b5138a`, `b68d7dc` | `GetCustomerInformation` in the customer module; `src/app/my-account/layout.tsx` with a browser guard (no token or a rejected one goes to `/sign-in?from=<page>`), one profile read shared by every account page, the legacy breadcrumb; `/my-account` (greeting, avatar, six cards); `/my-account/support`; the five aliases as `next.config` 307 redirects. |
| T2   | `ba9884d`, `126b16b` | `updatePhone`, `updateIdentity`, `changePassword` and `CustomerService.updateProfile` (legacy order, stops at the first failure, `partial` flag); `/my-account/account-information` and `/edit-account-information` with the "Seguridad" section.                                                                                                             |
| T3   | `885b377`, `41ff17e` | `resetPassword` (`invalid_token`, `weak_password`); `/customer/account/createPassword` (reads only `?token=`, `noindex`, `referrer: no-referrer`).                                                                                                                                                                                                            |
| T4a  | `c68e0e4`            | `src/modules/address`: gateway for list, create, update, delete, regions, SEPOMEX and the form config; service with the `AddressChange` metric; zod schemas; Server Actions. The form config never fails: without a usable Amasty config it falls back to the default Mexican fields.                                                                         |
| T4b  | `8d28121`            | `/my-account/address-book`: cards (default shipping first, "Principal"), delete with confirmation, empty state.                                                                                                                                                                                                                                               |
| T4c  | `cfd5a06`, `5d2d32b` | `/my-account/address-book/new` and `/edit/[id]`: fields from the Amasty JSON in the "Destinatario" and "Dirección" groups, region select, "Sin número", edit by id (a direct url works).                                                                                                                                                                      |
| T4d  | `5b75e19`, `5637c48` | Autocomplete on the new Google Places API (`AutocompleteSuggestion`, `Place.fetchFields`, session tokens), place-to-field mapping, accent-insensitive region match, SEPOMEX for the municipio.                                                                                                                                                                |
| fix  | `e257e14`            | After the T4 verification: a stored phone with spaces or a prefix no longer breaks an edit; an edit keeps the stored city, phone, postcode and region the config does not render; Amasty `"false"` flags read as off.                                                                                                                                         |
| T5   | this commit          | [Phase 5 routing](routing/phase-5.md), this report, env docs, `e2e/phase-5-smoke.spec.ts`, mock Magento support for the account pages.                                                                                                                                                                                                                        |

## Key decisions

Numbers refer to the specs and open points in `odd/tasks/phase-5-account.md`.

| #   | Decision                                                                                                                     | Legacy parity                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| S2  | The guard runs in the browser (the token lives in `localStorage`) and keeps the page in `?from=`.                            | Legacy `AuthRoute` stored `state.from` but nothing read it, so the shopper did not come back.                                            |
| S6  | The aliases are `next.config` redirects, temporary (307), query kept.                                                        | Legacy `DashboardRedirect` dropped the query string and redirected inside the SPA.                                                       |
| S9  | Profile save runs phone, then name and email, then password, and stops at the first failure.                                 | Same order as peregrine `useAccountInformationPage`; the legacy did not catch a phone failure.                                           |
| O1  | The address form is replicated in full (Amasty field config, Google autocomplete, SEPOMEX) on the **new** Google Places API. | The legacy uses the Places "legacy" line through `react-google-autocomplete` 2.7.3 (legacy since 2025-03-01, still supported by Google). |
| O2  | `window.ChupaChat` is loaded by the GTM container; the support buttons call it guarded.                                      | Same widget; Next does not identify the signed-in user to it.                                                                            |
| –   | The page stays in Next for a bad address id with a "No encontramos esta dirección." message.                                 | Legacy: a direct url to an edit page showed an empty form.                                                                               |

## Differences from the legacy PWA

| Area                     | Legacy PWA                                                                                                | Next                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New password             | Required whenever the Seguridad section is open                                                           | Optional: confirming the password to change the email does not force a password change.                                  |
| Email change             | Sent with an empty password if the section was closed (Magento then fails)                                | A client error that repeats the hint "Para cambiar tu correo deberás confirmar tu contraseña en la sección Seguridad."   |
| Error texts              | Magento's own (English) text                                                                              | Written for the cases the gateway tells apart: wrong password, email taken, weak password, expired link, partial save.   |
| After saving a profile   | Navigation inside the SPA                                                                                 | A full page load, so the shell reads the new data.                                                                       |
| Address fields           | All hidden until a place is picked                                                                        | Always visible (it also hid a prefilled edit form).                                                                      |
| Google components        | `administrative_area_level_2` overwrote the state; the region match picked the first region on a tie of 0 | `administrative_area_level_2` is only a municipio guess; no region is picked when nothing overlaps; accents are ignored. |
| Postal code              | Appended the `postal_code_suffix`                                                                         | Cut to 5 digits.                                                                                                         |
| Required / max length    | Venia English defaults                                                                                    | "Este campo es obligatorio" and "No debe exceder {n} caracteres."                                                        |
| Country                  | A select of Magento's countries                                                                           | Fixed to Mexico.                                                                                                         |
| Account pages in the PWA | Orders, quotes, saved cards, billing, invoices, social accounts                                           | Not built: still the PWA's.                                                                                              |

## Verification

| Check                                                 | Result                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (Vitest)                                   | 1577 (1368 at the start of the phase)                                                                                                                                                                                                                                                                                             |
| Integration (real server, mock Magento and CHAPI)     | 102, unchanged by the mock Magento extensions                                                                                                                                                                                                                                                                                     |
| `typecheck`, `lint`, `build`                          | Green on every task (one existing lint warning in `product-page-service.test.ts`); the build runs inside the local e2e                                                                                                                                                                                                            |
| `pnpm test:e2e --project local`                       | 28 passed (2026-11-02): the guard, dashboard, support, aliases, profile edit with a wrong then the right password, the reset-password link, the address book (list, add with the default fields, edit by card and by direct url, delete, Google suggestion with a fake `window.google`), plus the earlier cart and customer specs |
| `e2e/phase-5-smoke.spec.ts` (against the local stack) | 15 passed (2026-11-02), run through a temporary copy that pointed at the local stack; not yet run against staging or an edge                                                                                                                                                                                                      |
| Independent verification                              | T1 and T2 (account guard, password and email change), T3 (password reset) and T4 (stored addresses): no blockers; advisories in the feature document (L6, L8, L12), the ones worth fixing were fixed (`e257e14`)                                                                                                                  |
| Native review (RDD)                                   | Not run: `status` answered `managed_assets_outdated` (`gentle-ai sync --agent claude-code` rewrites managed assets, left to the user). `assess` over the branch is `high` with the named item 2                                                                                                                                   |
| Manual check by a person (`next dev` against staging) | The Google autocomplete answered `SERVICE_DISABLED` for the key's project until Places API (New) is enabled; nothing else reported yet                                                                                                                                                                                            |

## Pending before go-live

- [ ] **Google Cloud.** Enable **Places API (New)** in the project of the key Magento stores for Amasty, allow it in the key's API restrictions and add the staging and production domains to its referrer restrictions (see [phase 5 routing](routing/phase-5.md#before-go-live)).
- [ ] **Run the account pages against staging** and check what only ran against the mock: the custom customer fields (`middlename`, `social_profile_photo`, `phone_number`), the three profile mutations and their error texts, the real shape of `amasty_checkout_manage_checkout_fields`, `getSepomexData`, `addressComponents` and `includedRegionCodes` on the real Google API.
- [ ] **Password change and the token.** Check whether Magento revokes the token on a password change (the next page load would go to sign in).
- [ ] **Edge change** ([phase 5 routing](routing/phase-5.md)): add the rules, decide the alias hop, exclude the urls from prerender, run its checklist.
- [ ] **Social login decision of phase 4** (open point O2 there): with `/sign-in` on the PWA the `from` of the guard is ignored.
- [ ] **Manual checks by a person:** profile edit with a real account, address add, edit and delete, the reset-password email link, the dashboard, the support page.
- [ ] **Native review** if you want it: run `gentle-ai sync --agent claude-code`, then the review of the branch.
- [ ] **Delivery:** the branch is not pushed. The phase 4 stack showed that GitHub retargets stacked PRs to the first branch when the others are merged: plan the slices (they are one commit range per task) before opening PRs.
- [ ] Run `e2e/phase-5-smoke.spec.ts` against staging behind the edge (`E2E_PHASE5_SMOKE=1`).

## Known limitations and follow-ups

| Item                                | Notes                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No real 404 for a bad address id    | Under the account layout the status is already 200 when `notFound()` runs; the page shows "No encontramos esta dirección.". The pages are private and `noindex`.                                 |
| Default address delete              | Blocked in the UI and by Magento only; the service adds no check of its own.                                                                                                                     |
| Postal code and id bounds           | The server accepts a postal code of any 12 characters and an address id without an upper bound (Magento rejects it). Street lines beyond the configured count are cut when an address is loaded. |
| Partial profile save                | After a partial failure the shell keeps the old profile; a retry sends the already saved steps again (idempotent).                                                                               |
| Magento phone formats               | A stored phone is shown with digits only; saving normalizes it.                                                                                                                                  |
| Chat identity                       | `window.ChupaChat.identify`/`clear` are not called from Next.                                                                                                                                    |
| Billing section and social accounts | The "DIRECCIONES DE FACTURACIÓN" section of the address book and the "Cuenta vinculada" block of the profile edit are not built.                                                                 |
| Google API                          | The key is a browser key from Magento's Amasty config: changing it there also changes the PWA checkout.                                                                                          |
| `.env.example`                      | Still lacks `CART_REFRESH_BACKEND`, `E2E_PHASE4_SMOKE` and `E2E_PHASE5_SMOKE` (the agent cannot edit that file); they are documented in [`docs/environment.md`](environment.md).                 |

## Next step

Apply the edge change in [phase 5 routing](routing/phase-5.md) on staging (after phases 3 and 4), run its checklist and the phase 5 smoke, then production. What the edge still sends to the PWA is orders, quotes, saved cards, billing and invoices, and the checkout.
