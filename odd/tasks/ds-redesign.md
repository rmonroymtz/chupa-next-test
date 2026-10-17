# DS redesign — port the chupaprecios-pwa design system

Status (2026-10-17): T1 done, T2 next.

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
- [ ] T2 Shared primitives: Button (sizes 24–56, pill, CTA red, loading), Badge (V3 variants), Input/Select/Checkbox
  states, DS icon set; replace inline buttons. Check: unit tests + build.
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
