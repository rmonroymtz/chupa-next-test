# DS redesign — port the chupaprecios-pwa design system

Status (2026-10-18): T1 done and review approved (`a815c0e`, not pushed); T2 done (not pushed); T3 next.

## Objective

Bring the Next.js storefront to the new Chupaprecios design system (DS) built in `~/Proyectos/chupaprecios-pwa`
branch `CHUP-redesign` (scope `df13a1da..CHUP-redesign`, 148 files): tokens, grid, shared primitives, footer, promo
bar, header/search, categories nav, account/cart panels, price and product grids.

## Problem / why

The Next app still uses the legacy ch-theme tokens (`src/app/globals.css` `@theme`): CTA `#d84752`, Roboto Flex +
Noto + Montserrat, 1600px container with 1rem padding, different type scale, radii, neutrals and feedback colors. The
PWA has moved to the DS, so both storefronts would look different behind the same edge.

## Source of truth

- In-repo canonical spec: `chupaprecios-pwa/src/designSystem/tokens.js` ("the fidelity contract"); `tokens.css` is
  generated (its weights carry a wrong `px` suffix, do not copy that).
- Docs: `src/designSystem/HANDOFF.md` (red rule :193-195), `INTEGRATION-MAP.md`, `INCONSISTENCIAS.md`,
  `FIGMA-MAKE-HEADER-AUDIT.md` (header spec at 1440 and 375), `REVIEW-PLAYBOOK.md`.
- Figma: grid node 1154:108, icons 413:1844, payment/shipping logos 580:3045, categories dropdown 536:2918. The Figma
  Make prototype does not use DS tokens: DS wins on color and type. The `navbar.html` board is unreconciled.
- Red rule: `#BE424B` CTA fills (hover `#9F1239`, pressed `#881337`), `#D84752` accent/focus/sale price, `#FF0000`
  logo only.
- Grid: content 1260 / container 1440; margins 20/30/90, gutters 20/16/16, columns 6/12/12 at breakpoints 768/1024;
  product columns 2/5/5. Open contradiction: PWA footer CSS uses 1280 max-width; we follow the canonical 1260.

## Constraints

Phase constraints carried over (no Magento or API changes, hexagonal modules, `force-dynamic`). Keep the real site
content (links, addresses, payment methods); only the design changes. Generated artifacts in English. Legacy
behavior is checked in `~/Proyectos/chupaprecios-pwa`, never assumed.

## Tasks

Route per task: delegated (writer trigger: 2+ non-trivial files). Test-first where a deterministic behavior exists
(Vitest + Testing Library); pure token/CSS changes use structural checks + build + visual check on the dev server.

- [x] T1 Tokens, fonts and grid: DS colors (primitives + semantic), Inter body font (Roboto Flex display), type scale,
  space, radius, elevation, breakpoints 768/1024, `container-padded` = content-box 1260 with margins 20/30/90.
  Remap existing usages so nothing breaks visually by accident (radius names change values). Check: typecheck, lint,
  test, build.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first exception: token/CSS changes have no meaningful
    RED; the font and accent-class integration assertions were updated to the new intended values.
  - Files: `src/app/globals.css` (DS `@theme`: `ds-` colors in two tiers, DS type roles `text-display-xl`…`text-overline`,
    radius xs6/sm8/md12/lg16/pill only, `shadow-elevation-1..4`, `container-padded` content-box 1260 + 20/30/90),
    `src/modules/layout/ui/fonts.ts` (Inter body + Roboto Flex display; Noto Sans and Montserrat dropped), 27 UI files
    migrated from legacy `brand-*`/`ch-*`/`neutral-*`/`feedback-*` and Tailwind default greys to DS roles (legacy color
    tokens removed; only third-party `marketplace-*` colors remain), two CSS modules repointed to DS vars,
    `tests/integration/layout.test.ts` and `tests/integration/search.test.ts`.
  - Decisions: radius 4px (`rounded`, `rounded-sm`) → `rounded-xs` (6), 8px (`rounded-box`/`rounded-input`) →
    `rounded-sm`, 12px (`rounded-lg`) → `rounded-md`, `rounded-button` → `rounded-pill`. White-text fills (CTAs, cart
    count, current page, checked filter) use `ds-cta` #BE424B; interactive text links use `ds-link` #BE424B; sale and
    decorative accents and the dark-footer hover use `ds-accent` #D84752; focus outlines `ds-focus` #D84752. The legacy
    text size scale stays until each surface moves to the DS roles. tokens.js and grid.module.css agree on 1260 and
    20/30/90; `width: 100%` from the PWA container was dropped (with content-box it overflows by the margins).
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 108 files / 1027 tests pass;
    integration 7 files / 102 tests pass; build pass. Remaining `sm:`/`xl:`: site-header (search width), related
    products, chupachoice grid. Visual check on the dev server pending (user).
  - Commit: the T1 work-unit commit `feat(ds): adopt the design system tokens, fonts and grid` (hash recorded in the
    Progress line of the next task, a commit cannot contain its own hash).
- [x] T2 Shared primitives: Button (sizes 24–56, pill, CTA red, loading), Badge (V3 variants), Input/Select/Checkbox
  states, DS icon set; replace inline buttons. Also fix the T1 review findings: always emit the DS theme vars used by
  CSS modules (`@theme static` or equivalent) and add a structural test that removed legacy token names are unused.
  Check: unit tests + build.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: Testing Library tests written first; RED = 4
    test files failing (modules `@/shared/ui/*` not found), GREEN = 4 files / 37 tests. The legacy-token test went
    GREEN directly against T1 and turned RED on a planted `bg-brand-red rounded-button` (2 offenders), then removed.
  - Files: `src/shared/ui/` (`button.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `field.tsx`,
    `icon.tsx`, `icon-catalog.ts`, `class-names.ts`), `src/app/globals.css` (`@theme static`),
    `src/modules/layout/ui/icons.tsx`, `src/modules/cart/ui/add-to-cart.client.tsx`,
    `src/modules/cart/ui/mini-cart.client.tsx`, `tests/unit/shared/ui/*` (button, badge, form-fields, icon),
    `tests/unit/app/legacy-design-tokens.test.ts`.
  - Decisions: shared atoms live in `src/shared/ui/` (cross-module, kebab-case files, Tailwind DS classes, no CSS
    modules). Button variants follow the DS `primary`/`secondary`/`tertiary`, sizes `xs`/`sm`/`md`/`lg`/`xl` =
    24/32/40/48/56; secondary/tertiary text uses `ds-link` #BE424B instead of the DS source's #D84752 (under 4.5:1
    on white at 13–16px). Loading keeps the variant colour, hides the label with `opacity-0` (keeps width and the
    accessible name) under a spinner, sets `aria-busy` and `disabled`. With `href`, Button renders `next/link`
    (`prefetch={false}`, the repo avoids prefetching Magento-backed pages) for internal paths, a plain `<a>` for
    external urls or `nativeAnchor` (edge-routed PWA Studio `/cart`, `/checkout`); a disabled/loading link drops its
    `href` and gets `aria-disabled`. Badge = C2 `new`/`sale`/`featured`/`soldout`/`shipping`/`lastunits` + `neutral`,
    `radius-xs`, all colors already existed as T1 tokens. Form fields share `useFieldA11y` (`useId`, `aria-invalid`
    only on error, `aria-describedby` keeps the caller's ids); focus uses the DS reference pattern 2px `ds-focus`
    outline + 2px offset on all three (INCONSISTENCIAS "Transversal"); Select gained `success` for parity, Checkbox
    gained helper/error. Icon ports all 48 glyphs (41 board + 7 extras) as a typed `IconName` union, `aria-hidden` +
    `focusable=false` unless `title` (then `role="img"` + `aria-label`). `icons.tsx` keeps its exports; `MenuIcon` and
    `ChevronDownIcon` delegate to `Icon` (same feather glyphs, 2px stroke kept), the legacy user/search/social glyphs
    stay until T3/T5. Migrated: the add-to-cart submit (primary lg, `loading`), mini-cart "Finalizar compra"
    (primary lg) / "Ver carrito" and "Reintentar" (secondary lg). Not migrated: `search-pagination.tsx` and
    `search-filters.tsx` have no `<button>`s (page links, a text link and a `<summary>`; no DS pagination molecule),
    quantity steppers and the cart trigger/close are icon buttons, and `AvailabilityBadge` does not map to C2 (no
    in-stock variant; soft fills with dark text). R3-pb-css-var-dependency: the DS `@theme` block is `@theme static`
    (Tailwind v4 docs, "Generating all CSS variables"); the built CSS defines `--color-ds-cta-hover`,
    `--color-ds-accent` and also unused ones such as `--color-ds-info-bg`. R3-no-token-coverage: the structural test
    scans `src/**/*.{ts,tsx,css,js,mjs}` for the removed `brand-*`/`ch-*`/`feedback-*`/legacy `neutral-*` colors,
    `--container-site`/`max-w-site`, `rounded-{box,input,button,badge,xl,2xl,3xl}`, `shadow-header` and the dropped
    fonts, ignoring `ds-*`, `marketplace-*` and `--pb-brand-*`.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 113 files / 1066 tests pass;
    integration 7 files / 102 tests pass; build pass. Visual check on the dev server pending (user): add-to-cart
    spinner, mini-cart footer buttons (Ver carrito/Reintentar are now red outline instead of dark outline).
  - Commit: the T2 work-unit commit `feat(ds): add the shared button, badge, form field and icon primitives` on
    `feat/ds-02-primitives` (hash recorded in the next Progress line).
- [ ] T3 Footer + missing assets (chupacredit, estafeta, profeco, logos diff). Check: unit/integration + visual.
- [ ] T4 Promo bar (rotating, pause on hover, reduced motion, static fallback). Check: unit + visual.
- [ ] T5 Header + search with StoreSelector pills (two rows, Figma Make spec). Check: unit/integration + visual.
- [ ] T6 Categories dropdown (two panels, desktop) + light drawer (< 1024). Check: unit/integration + visual.
- [ ] T7 Account panel + mini-cart restyle (head, footer with subtotal + "Ir a pagar"). Check: unit + visual.
- [ ] T8 Price + product cards + product grids 2/5/5. Check: unit + visual.

## Delivery strategy

Same as phases 1–3: `ask-on-risk`, chain `stacked-to-main`; one PR per task slice. Forecast well over 400 authored
lines in total.

## Progress

- 2026-10-17: discovery done (read-only explorer over `chupaprecios-pwa` `CHUP-redesign` vs this repo); user approved
  the full 8-task scope.
- 2026-10-17: T1 done (DS tokens, Inter/Roboto Flex, DS radius/elevation, 1260 grid); all checks green, visual check
  pending.
- 2026-10-18: T1 commit `a815c0e` on `feat/ds-01-tokens-grid` (not pushed). Assessed medium (`slice_budget_reached`);
  user granted review; native review approved and acknowledged (lineage `review-9ebb102963f675ca`) with two advisory
  findings, both carried into T2: R3-pb-css-var-dependency (WARNING: `page-builder.module.css` reads
  `--color-ds-cta`/`-cta-hover`/`-accent` without fallback, and Tailwind v4 only emits theme vars that some scanned
  utility uses; fix with `@theme static` or explicit emission) and R3-no-token-coverage (SUGGESTION: add a structural
  test that removed legacy token names are unreferenced in `src`).
- 2026-10-18: T2 done (shared Button/Badge/Input/Select/Checkbox/Icon in `src/shared/ui`, cart CTAs migrated, DS
  theme vars always emitted, legacy-token structural test); all checks green, visual check pending.
