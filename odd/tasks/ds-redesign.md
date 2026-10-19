# DS redesign — port the chupaprecios-pwa design system

Status (2026-10-19): T1–T6, T7a and T7c done and merged to `main` (`c371707`); T8 done on `feat/ds-08-product-cards` (not pushed), visual check pending; T7b pending (no customer session).

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
- [x] T3 Footer + missing assets (chupacredit, estafeta, profeco, logos diff). Also fix T2 review finding
  R3-disabled-link-onclick: a disabled/loading link `Button` must not run the caller `onClick` (test it). Check:
  unit/integration + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: button RED = 2 failing (`a disabled link` /
    `a loading link does not run the caller onClick`), GREEN = 18/18; footer RED = 3 failing of 11 (DS Icon social
    glyph, grey `filter` payment logos, 1→2→4 grid in `container-padded`), GREEN = 11/11; icon RED = 2 failing
    (catalog 50 with `facebook`/`instagram`, brand glyph fill), GREEN = 5/5. Content assertions kept and extended
    (hours incl. "Horario:", both addresses, wordmark/AMVO alts, lazy images, copyright line).
  - Files: `src/modules/layout/ui/site-footer.tsx` (rebuilt), `src/modules/layout/ui/icons.tsx` (legacy
    Facebook/Instagram glyphs retired, only the footer used them), `src/shared/ui/icon-catalog.ts` (brand extras
    `facebook`/`instagram` = the DS Footer organism glyphs, own fill/stroke), `src/shared/ui/button.tsx`,
    `public/images/layout/payments/chupacredit.svg`, `public/images/layout/shipping/estafeta.svg`,
    `tests/unit/modules/layout/ui/site-footer.test.tsx`, `tests/unit/shared/ui/button.test.tsx`,
    `tests/unit/shared/ui/icon.test.tsx`. `footer-content.ts` unchanged.
  - Decisions: DS organism layout: `grid-cols-1` → `md:grid-cols-2` (brand spans) → `lg:grid-cols-[1.1fr_1fr_1fr_1.2fr]`,
    gaps 32/40 (DS space 8/10), padding 40/24 → 48/32, inside `container-padded` (1260, not the PWA's 1280). Groups:
    brand + social; Centro de ayuda + Redes Sociales; Conócenos + AMVO (56px, 90% opacity); Atención a clientes +
    both offices + payments. Type roles: titles `text-body-lg` bold inverse (body font, as the DS; was `font-display`),
    text/links `text-body-md` neutral-300 → hover inverse + underline, copyright `text-body-sm` neutral-400 (4.8:1).
    Social = 34px white pill buttons with an 18px dark DS `Icon`. Payment logos 22px high, max 46px wide,
    `brightness-0 invert-[0.72]` (DS filter). Focus: white 2px outline (`ds-focus` #D84752 is 2.6:1 on #3B3B3B,
    below the 3:1 non-text minimum). Headings stay `h2` (the PWA uses `h3`; `h2` is the right level under the page
    `h1`). Images stay lazy. Disabled/loading link `Button` overrides `onClick` with `preventDefault` after the
    caller props, so the handler never runs.
  - Assets (byte-compare, all differ in bytes): `amex`/`mastercard` normalize identical to the PWA's repaired
    6f0b069f versions (ours were never broken) → kept. `visa`: PWA moved to `visa.png` because its `visa.svg` was a
    renamed PNG; ours is a real, valid SVG → kept. `kueski`, `mercadopago`, `oxxo`, `paypal`, `spei`, `stores/*`:
    different exports of the same marks, all valid XML (`xmllint`) → kept. `amvo-white.svg` = `brand/amvo.svg` path
    data (only ids differ) → kept. `logo-white.svg` vs `brand/chupaprecios-light.svg`: same artwork, sub-pixel export
    differences (`10.037` vs `10.038`) and the same fills → kept. `logo.svg` (header only) uses `#000` where the DS
    `chupaprecios.svg` uses brand purple `#2a2031` → left for T5 (header). Copied `chupacredit.svg` (payments) and
    `estafeta.svg` (new `shipping/` folder) from the DS catalog; neither is rendered (the PWA footer renders
    neither). `profeco.svg` not copied: `para-UX`, the PWA footer does not render it (INCONSISTENCIAS Footer row).
  - Content differences vs the PWA footer (kept the Next content, not invented): the PWA lacks "Facturación",
    Mercado Pago and Kueski Pay logos, "Horario:", the new-tab disclosure and Spanish copyright ("all rights
    reserved"); the PWA adds a visible "Formas de pago" heading (Next keeps the `aria-label="Métodos de pago"` list),
    writes "Preguntas Frecuentes (FAQ)", "Redes sociales", "Oficina central" / "Centro de desarrollo tecnológico"
    without the colon, "Col." / "C.P." and the CDMX line without the trailing "Col.", and puts the whole hours line in
    one sentence. The PWA has a checkout-only footer variant (Next has no checkout pages).
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 113 files / 1076 tests pass;
    integration 7 files / 102 tests pass; build pass (footer utilities present in the built CSS); dev server
    `/aviso-privacidad` 200 with the new footer markup. Visual check on the dev server pending (user): Kueski and
    Mercado Pago are wide marks and render small under the DS 46px cap.
  - Commit: the T3 work-unit commit `feat(layout): rebuild the footer on the design system` on `feat/ds-03-footer`
    (hash recorded in the next Progress line).
- [x] T4 Promo bar (rotating, pause on hover, reduced motion, static fallback). Check: unit + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: RED = 2 test files failing (modules
    `@/modules/promo-bar/{infrastructure,ui}/*` not found; the 2 domain predicate tests were written with the type
    file and passed directly), GREEN = 3 files / 15 tests. The integration `expectLayout` assertion (promo region
    before `<header`, first slide text) was added together with the mount, not observed RED.
  - Files: `src/modules/promo-bar/domain/promo-bar.ts` (slide/content types, `hasPromoContent`),
    `src/modules/promo-bar/infrastructure/default-promo-bar-content.ts` (`getPromoBarContent()`, the 4 slides of the
    Magento `top-banner-slider` block verbatim, interval 5000), `src/modules/promo-bar/ui/{promo-bar.tsx,
    promo-slide.tsx,promo-bar-rotator.client.tsx}`, `src/app/layout.tsx` (mounted above `SiteHeaderContainer`),
    `tests/unit/modules/promo-bar/{domain,infrastructure,ui}/*`, `tests/integration/layout.test.ts`.
  - Decisions: static content only behind `getPromoBarContent()` (no `PROMO_BAR_ENDPOINT`/fetch: the API does not
    exist; a future source only changes that function). Slides render on the server (`PromoBar`, `PromoSlide` with
    `next/image` for the Kueski logo, `public/images/layout/payments/kueski.svg`, 16px high); only the rotation is a
    client component receiving the rendered slides. All slides are stacked in one grid cell (`[grid-area:1/1]`) so
    the bar keeps the tallest slide's height and never shifts the page while rotating; inactive slides are
    `invisible opacity-0`, `aria-hidden` and `inert`; crossfade 400ms (DS `promoFade` 0.4s), `motion-reduce:
    transition-none`. Rotation via one `setTimeout` per slide; paused while hovered or while focus is inside;
    reduced motion is the initial (server) state, so no timer runs until `matchMedia` says otherwise, and none for a
    single slide. `aria-live="off"` always (the DS has no controls). Region `<section aria-label="Promociones">`
    (the DS uses "Avisos" with `aria-live="polite"`, which announces every rotation). Type `text-caption` (12/16, as
    the brief; the DS CSS uses 14/20), `text-ds-text` #3B3B3B, `bg-ds-surface`, bottom `border-ds-border`, centered;
    `container-padded py-2` (the container's 20px mobile margin is the DS 20 side padding, no double padding).
    Not ported: the PWA hides the bar on `/checkout` (no checkout pages in Next).
  - Known gap (WCAG 2.2.2 Pause, Stop, Hide): the bar auto-updates with no explicit pause control (the DS molecule
    has none); hover/focus pause and reduced motion only partly cover it. Needs a product decision (e.g. a small
    pause button) before calling it conformant.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 116 files / 1091 tests pass;
    integration 7 files / 102 tests pass; build pass (`duration-400`, `grid-area:1/1`, `text-caption` in the built
    CSS); dev server `/aviso-privacidad` 200 with the promo region markup. Visual check on the dev server pending
    (user): bar height on mobile (tallest slide wraps), Kueski logo size inline.
  - Commit: the T4 work-unit commit `feat(promo-bar): add the rotating promo bar above the header` on
    `feat/ds-04-promo-bar` (hash recorded in the next Progress line).
- [x] T5 Header + search with StoreSelector pills (two rows, Figma Make spec). Check: unit/integration + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. The trigger restyle needed `mini-cart.client.tsx`, outside
    the first derived surface; the parent extended the surface (inside the authorized T5 scope).
  - Test-first: header RED = 5 failing in `site-header.test.tsx` (no "Mi cuenta" link, old placeholder, no
    `radiogroup`, `sm:w-[300px]`/`xl:w-[360px]` in the header, logo without `#2a2031`) + `search-form.test.tsx` failing
    at import (`store-selector.client` missing); GREEN = layout unit 47/47. Cart RED = 1 failing (legacy `cart.svg`
    `<img>` still in the trigger), GREEN = mini-cart 10/10. The integration additions (form `id`, 5 radios with
    `form="site-search"`, placeholder) failed once on attribute order only (React emits `class` between `form` and
    `name`; regex loosened), then passed.
  - Files: `src/modules/layout/ui/site-header.tsx` (rebuilt), `store-selector.tsx` + `store-selector.client.tsx`
    (new), `search-form.tsx`, `search-form-fields.tsx`, `current-search-form-fields.client.tsx`,
    `search-form.module.css` (rewritten: DS pills + search pill, per-store colored tabs and `--store-color` deleted),
    `cart-trigger-slot.tsx` (comment), `icons.tsx` (legacy `UserIcon`/`SearchIcon` and the `Svg` helper retired, only
    the header used them), `src/modules/cart/ui/mini-cart.client.tsx` (trigger only), `public/images/layout/logo.svg`
    (= DS `brand/chupaprecios.svg`, wordmark `#2a2031`), `tests/unit/modules/layout/ui/{site-header,search-form}.test.tsx`,
    `tests/unit/modules/cart/ui/mini-cart.client.test.tsx`, `tests/integration/layout.test.ts`. `icon-catalog.ts`
    unchanged (`user`, `search`, `shopping-cart` already there).
  - Decisions: row 1 = mobile menu · logo · store pills · actions; below 1024 the pills wrap to their own full-width
    line (`order-last basis-full`), from 1024 they sit between logo and actions (`ml-auto` both sides). Row 2 = search
    pill. `container-padded` + `py-3`/`lg:py-5`, gaps 12/16 (DS 20/12 and 90/20 paddings). Bottom `border-ds-border`
    instead of the elevation shadow (live PWA header). Only `md:`/`lg:`. Logo sized by width 102/125/136 (the DS lockup
    is ~10.8:1; the audit's 136×24 box cannot hold it, the live PWA also sizes by width). Store pills: native radios
    in a `role="radiogroup"` "Tienda donde buscar" outside the form, joined by `form="site-search"` (no JS; submitted
    params unchanged `store`/`query`/`page=1`, asserted with `FormData`); same stores, order and default; current
    store from the url (`CurrentStoreSelector`, no Suspense, same as the fields); checked pill = `ds-accent` #D84752
    border (4:1 on white) + elevation-1; focus 2px `ds-focus` outline. Search pill `ds-surface-subtle` #f8f8f8 +
    `ds-border-subtle` #f0f0f0, 40px, leading DS `search` icon as the submit ("Buscar"), placeholder "Ingresa ASIN, SKU
    o Nombre del producto" in `ds-text-secondary`, focus outline on the pill when the input is focused. "Mi cuenta"
    (DS `user`, `/sign-in`) and the cart (DS `shopping-cart`) show labels from 1024 (Inter 13/18, cart medium); below,
    icons only in 40px targets ("Mi cuenta" `sr-only`; the cart keeps its `aria-label`). The cart count is one element:
    a badge below 1024, "(N)" from 1024 (CSS parens), still hidden at 0.
  - Spec deviations: mobile input text 16px (not 12/16) so iOS Safari does not zoom on focus; placeholder #6e6e6e (DS
    text-secondary) instead of #7e7e7e; store list kept (ChupaChoice, Amazon, eBay, Target, Acme; Make adds Walmart);
    mobile pills show logos only (no 56px icon + label columns); layout switch at 1024 (PWA 1160); empty cart shows
    "Carrito" without "(0)" (the existing count contract hides it at 0); no "Categorías" (T6). A11y notes: the
    magnifier precedes the input in focus order (leading, as the spec); on mobile the pills come before the actions in
    DOM while they render below them; the cart `aria-label` (kept by contract) does not start with the visible "Carrito
    (N)" (WCAG 2.5.3 label-in-name, "carrito" is contained). `public/images/layout/cart.svg` is now unused (outside the
    surface, not deleted).
  - Changed assertions: site-header "banner" test expects "Mi cuenta" → `/sign-in` and a single drawer "Iniciar
    sesión" (was two); the store checks moved out of the search-form test into a new pills test (`radiogroup` in the
    banner, not `group` inside the form, plus `radio.form`, `FormData` and selecting eBay); added placeholder and
    `type="submit"` checks, the breakpoint test and the logo color test. search-form test reads the radios from the
    radiogroup and also asserts the submitted `FormData`. mini-cart: new "Carrito (N)" test. layout integration: form
    `id`, 5 associated radios, placeholder. No behavioral assertion removed.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 116 files / 1095 tests pass;
    integration 7 files / 102 tests pass; build pass (built CSS has the `content:"("` parens); dev server `/`,
    `/aviso-privacidad` 200 with chupachoice checked, `/search.html?query=test&store=amazon` 200 with amazon checked,
    new header and "Carrito" markup. Visual check on the dev server pending (user).
  - Commit: the T5 work-unit commit `feat(layout): rebuild the header and search on the design system` on
    `feat/ds-05-header-search` (hash recorded in the next Progress line).
- [x] T6 Categories dropdown (two panels, desktop) + light drawer (< 1024). Check: unit/integration + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: RED = 3 layout test files failing at import
    (`categories-dropdown.client`, `nav-drawer.client` missing; the updated `site-header.test.tsx` imports them),
    31 other layout tests passing; GREEN = layout unit 10 files / 57 tests. The integration additions (closed
    disclosure + `<dialog>` markup, no megamenu) passed on the first run; the existing position-order assertion failed
    once (see changed assertions) and was rescoped.
  - Files: `src/modules/layout/ui/categories-dropdown.client.tsx` (new), `categories-dropdown.tsx` (new, invisible
    same-footprint placeholder), `nav-drawer.client.tsx` (new), `nav-drawer.tsx` (new, placeholder),
    `site-header.tsx` (dropdown slot right after the logo, bottom category bar removed), `site-header.container.tsx`;
    deleted `category-nav.tsx` (megamenu + `<details>` menu), `category-nav-scroller.client.tsx`, `icons.tsx` (its
    `MenuIcon`/`ChevronDownIcon` only served the megamenu; DS `Icon` used directly) and
    `tests/unit/modules/layout/ui/category-nav-scroller.test.tsx`; tests
    `tests/unit/modules/layout/ui/{categories-dropdown,nav-drawer,site-header}.test.tsx`,
    `tests/integration/layout.test.ts`. No data change: the `HeaderMenu` query already fetches three levels below the
    root (dropdown uses two, the drawer all three); query, mapping, caching (`no-store`, `force-dynamic`, React
    `cache()` = one call per request) and category urls unchanged. No CSS module (Tailwind DS classes only).
  - Decisions: desktop (from 1024) = "Categorías" button (DS `menu` 18 + Inter semibold 14/20, gap 6) right of the
    logo (gap 20, audit §4), a disclosure (`aria-expanded`/`aria-controls`, no `role="menu"`). Panel 740 wide, 12px
    under the row, `radius-md`, `border-ds-border`, `elevation-2`: left list 264 (DS `grid` placeholder icon + name +
    chevron, active row `ds-surface-subtle`, chevron `ds-link`), right detail = title link (`ds-link`, 16 semibold),
    children in 2 columns filled by column (CSS `columns`, INCONSISTENCIAS "orden de columnas"), "Ver todo en {cat}"
    + DS `arrow-right`. Hover, focus, Up/Down/Home/End pick the active category; Right enters its detail, Left
    returns. Each detail follows its row in the DOM (absolutely placed in the right column), so Tab from a row enters
    the subcategories it revealed instead of cycling every row first. Escape closes and focuses the button; a
    pointerdown outside or focus leaving closes. Mobile/tablet (< 1024) = the menu button (hamburger 22, "Categorías"
    label visible from 768 as the PWA `navTrigger`, sr-only below) opening a native modal `<dialog>` (`showModal`
    focus trap, `aria-modal`, `aria-label="Menú"`), left side, `w-full max-w-[24rem]`, `ds-overlay` backdrop:
    header 72px (wordmark home link + "Cerrar menú" DS `x`), Venia-style drill-down (a category with subcategories is
    a button opening its own view with "Volver" + `h2` + "Ver todo en {cat}"; leaves are 56px links), footer auth bar
    64px with "Iniciar sesión" (`ds-link`, DS `user`). Focus: close button on open, the new view's "Volver" on drill,
    the opened branch on back, the menu button on close; Escape = the dialog `cancel` event; backdrop click closes;
    `body` overflow hidden while open and restored; reopens at the top level. Both components render every link on
    the server (closed panel, inactive details and drawer views are `hidden`), so all category links stay in the
    markup as with the megamenu (e2e `nav[aria-label="Categorías"|"Menú principal"]` locators still hold). Empty
    menu: the dropdown renders nothing (invisible placeholder keeps the width), the drawer keeps sign-in.
  - Spec deviations: links keep today's category urls (`/{url_path}.html`), not the PWA's
    `/search.html?query=<url_path>&store=` targets (brief rule); layout switch at 1024 (PWA 1160, as T5); the DS
    `grid` icon is a placeholder on every row (no per-category icons in the data, same gap as the PWA); no slide
    animation on the drawer (native dialog, no motion); no store/currency switchers in the drawer footer (Next has
    none); the dropdown opens on click only (as the PWA). A11y notes: closed `<dialog>` content is outside the
    accessibility tree until opened; the drawer stays open if the viewport grows past 1024 while open (its button is
    then hidden; Escape/backdrop still close it).
  - Changed/deleted assertions: `site-header.test.tsx` "banner" now finds the drawer "Iniciar sesión" with
    `hidden: true` (closed `<dialog>`; still exactly one, still `/sign-in`); the breakpoint test skips `nav, dialog`
    (was `nav, details`); the four megamenu/`<details>` tests ("desktop navigation: every level…", "without categories
    keeps the reserved bar" incl. its `h-12` check, "mobile navigation is a native disclosure…" incl. `SUMMARY` and
    the exact href list, "mobile navigation still offers sign-in…") were replaced by the dropdown/drawer tests, which
    assert the same hrefs at every level (dropdown: levels 1–2, drawer: levels 1–3 + `/sign-in`) and sign-in when
    the menu is empty; added "row 1 order" and "no megamenu" tests. Deleted the 7 scroller tests with the scroller.
    `layout.test.ts`: the "ordered by position" check now reads the indexes inside the dropdown `<nav>` (the drawer,
    first in the DOM, lists a branch as a button and its link in a later view, so page-wide first occurrences no longer
    follow menu order); its `electronica/audio`, `Interna` and single `HeaderMenu` call assertions unchanged; the
    failure-case comment updated (assertions unchanged). Added: closed disclosure/dialog markup, no scroller or
    `<details>`.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 117 files / 1105 tests pass;
    integration 7 files / 102 tests pass; build pass (`w-66`, `left-66`, `columns-2`, `h-18`, `w-[46.25rem]`,
    `max-w-[24rem]` in the built CSS); impeccable detector: no findings; dev server `/` and `/computo.html` 200 with
    12 dropdown rows and the closed drawer markup. Visual check on the dev server pending (user): panel width/position
    at 1024, detail height with many subcategories (scrolls inside the panel), drawer on phone/tablet.
  - Size: ~860 added / ~450 deleted (two interactive components with their tests; deletions are the dead megamenu,
    scroller, legacy icons and their tests). Over the 400 heuristic as one coherent work unit, not split.
  - Commit: the T6 work-unit commit `feat(layout): replace the megamenu with the categories dropdown and nav drawer`
    on `feat/ds-06-categories-nav` (hash recorded in the next Progress line).
- [x] T7a Mini-cart restyle (head, footer with subtotal + "Ir a pagar") (user, 2026-10-18: mini-cart first). Check: unit + visual. Also fix the T6 review warnings: the dropdown Escape handler must respect `event.defaultPrevented` (no clash with the mini-cart), close the dropdown when focus leaves to nothing (window blur), and close the drawer when the viewport reaches 1024; make the drawer overflow restore idempotent.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: baseline cart + layout unit 8 files / 63 tests
    green; RED = 10 failing of 71 (mini-cart: DS panel head/footer, singular title + "Agotado", Escape marked handled,
    loading head, empty state without CTAs; dropdown: prevented Escape ignored, blur to nothing closes, focusable
    root keeps panel clicks inside; drawer: viewport ≥1024 closes + listener cleanup, idempotent overflow restore);
    GREEN = 8 files / 71 tests.
  - Files: `src/modules/cart/ui/mini-cart.client.tsx` (panel only; trigger untouched), `src/modules/cart/ui/mini-cart-item.tsx`
    (new row component), `src/modules/layout/ui/categories-dropdown.client.tsx`, `src/modules/layout/ui/nav-drawer.client.tsx`,
    `tests/unit/modules/cart/ui/mini-cart.client.test.tsx`, `tests/unit/modules/layout/ui/{categories-dropdown,nav-drawer}.test.tsx`,
    `e2e/local/shared-cart.spec.ts` (labels only).
    No action, store or data change.
  - Decisions: the mini cart stays a native modal `<dialog>` (`showModal`, backdrop click, close button, focus back
    to the trigger) but becomes the DS `.miniCart` surface: floating 360px (`min(22.5rem, 100vw-1.5rem)`), 12px from
    the top-right, max height `min(35rem, 100dvh-1.5rem)`, `radius-lg`, `border-ds-border-subtle`, `elevation-3`
    (was a full-height right sheet). Head: `h2` title (14 bold uppercase, the dialog name), "Editar carrito" (13
    semibold `ds-link`, plain `<a href="/cart">`, edge-routed) only when there are items (PWA hides it when empty and
    disables it while loading), close = DS `x` icon. Body: scrolling rows (`MiniCartItem`: 80px thumbnail, name link,
    options, "Agotado", "Cantidad: N" + unit price). Footer (sticky, not scrolled): "Subtotal (N art.):" + price
    (15 bold) and full-width primary lg "Ir a pagar" (`/checkout`, `nativeAnchor`). Loading/empty/error centered;
    "Reintentar" now secondary md. Escape: the dialog `onKeyDown` closes it and calls `preventDefault`, so the
    document listener of the dropdown skips it (React's root listener runs before the document one).
    No quantity stepper or remove button: Next has no cart mutation (port/actions only add and read), the brief
    keeps Magento/API changes out of scope, and the PWA mini-cart itself only removes (stepper rows pending there
    as sub-slice 4b); quantity and removal stay in the PWA cart via "Editar carrito". No analytics events exist in
    the Next mini cart (the PWA `CART_REMOVE_ITEM` belongs to remove), so none were added or lost.
    T6 warnings: R3-dropdown-escape-focus (document Escape ignores `defaultPrevented`); R3-dropdown-blur-focus-null
    (blur to `null` closes; the root is `tabIndex={-1}` + `outline-none`, so clicks on non-focusable panel content,
    and on links/buttons in Safari, move focus to the root instead of to nothing); R3-drawer-viewport-grow (while
    open, a `(min-width: 1024px)` `change` listener closes through `dialog.close()`, removed on close/unmount);
    R3-drawer-overflow-restore (`overflowRef` is `null` when unlocked; lock saves once, unlock restores once).
  - Renamed/removed labels: dialog title "Carrito de compras" → "Carrito" / "Carrito (N artículos|artículo)";
    "Finalizar compra" → "Ir a pagar" (same `/checkout`); "Ver carrito" (footer button) → "Editar carrito" (head
    link, same `/cart`); "N productos" line removed (count moved into the title); "Subtotal: $X" → "Subtotal (N art.):"
    + price; the close glyph "×" → DS `x` icon (name "Cerrar carrito" unchanged). Kept: "Cargando tu carrito...",
    "No pudimos cargar tu carrito.", "Reintentar", "No hay artículos en tu carrito.", "Agotado", "Cantidad: N".
  - Changed assertions: mini-cart "opens a dialog with items, subtotal and links…" replaced by "opens the DS panel…":
    dialog name `Carrito de compras` → `Carrito (3 artículos)`, `3 productos` → title, `Subtotal:` → `Subtotal (3
    art.):` in the footer, `Finalizar compra` → `Ir a pagar` (/checkout), `Ver carrito` → `Editar carrito` (/cart) in
    the head; item link/options/quantity kept and scoped to the row, unit price and absence of the old links added.
    "shows the legacy empty message" additionally asserts no "Ir a pagar"/"Editar carrito". No assertion removed.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 117 files / 1113 tests pass;
    integration 7 files / 102 tests pass; build pass (panel arbitrary values in the built CSS); dev server `/` 200.
    `e2e/local/shared-cart.spec.ts` (surface extended by the parent mid-task, derivation gap inside the task):
    dialog name `Carrito de compras` → `/^Carrito/`, `Finalizar compra` → `Ir a pagar` (`/checkout`), `Ver carrito`
    → `Editar carrito` (`/cart`); every step kept (open, product text, both hrefs, Escape closes). It typechecks and
    lints; not run (its global setup builds and starts a standalone Next + mock backends). Visual check on the dev server pending (user): floating panel
    at 375/1024/1440, long item lists scrolling under the sticky footer, uppercase title truncation.
- [x] T7c Mini-cart parity fix (user, 2026-10-18: "no se ve igual que la PWA"; "que quede igual al de PWA", remove button included): non-modal dropdown anchored under the cart trigger with a fade (no backdrop, no close button), PWA item rows (legacy look: 80px object-cover 4px radius image link, name 400, stacked 12px quantity and bold price, 20px row gap, no dividers, 32px trash remove button), empty state without header, below 1160px the trigger links to /cart, CTA 700/2px border, panel-level stock message, no option lines. Remove uses a new server action over Magento `removeItemFromCart` (no Magento change). Check: unit + integration + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: baseline cart + layout unit 18 files / 150
    tests green; RED = 32 failing of 175 (19 files): remove schema (6), service `removeCartItem` (3), gateway
    `RemoveItemForMiniCart` + error mapping (3, MSW + fixture), `removeCartItemAction` (3, new file), mini cart
    (16: disclosure without dialog/haspopup, <1160 link + ≥1160 container classes, non-modal panel/PWA rows/no
    options/trash names/CTA classes, stock message, Escape + focus back, outside pointer, scroll lock, head-less
    loading/empty, refresh fade, remove busy → list + count, last item, failure alert, invalid cart), site header (1).
    GREEN = 19 files / 175 (one RED test fixed on the test side: the metrics helper is `metricsNamed`, not `metrics`).
  - Files: `src/modules/cart/{application/{cart-input,cart-service,ports}.ts,infrastructure/{cart.queries,magento-cart-gateway}.ts,ui/{cart-actions.ts,mini-cart.client.tsx,mini-cart-item.tsx}}`;
    tests `tests/unit/modules/cart/{application/{cart-input,cart-service}.test.ts,infrastructure/magento-cart-gateway.test.ts,ui/{cart-actions.test.ts (new),mini-cart.client.test.tsx}}`,
    `tests/unit/modules/layout/ui/site-header.test.tsx`, `tests/integration/pdp.test.ts`,
    `tests/integration/support/mock-backends.ts` (mock `RemoveItemForMiniCart` for the local stack),
    `tests/fixtures/magento/remove-item-from-cart.json` (new, shape of the peregrine document), `e2e/local/shared-cart.spec.ts`.
  - Remove end to end: `REMOVE_ITEM_MUTATION` = venia-ui `MiniCart/miniCart.gql.js` `RemoveItemForMiniCart($cartId,
    $itemId) { removeItemFromCart(input: { cart_id, cart_item_uid }) { cart { …mini-cart fields } } }` (the PWA also
    selects `CartPageFragment`, dropped: it only feeds the PWA cart page cache; shared `MINI_CART_FIELDS` with
    `MiniCartQuery`). Magento `RemoveItemFromCartOutput` has only `cart` (PWA `lastCachedGraphQLSchema.json`): no
    `user_errors`; GraphQL errors map to `invalid_cart` (peregrine messages) or `failure`. Port
    `removeItemFromCart(cartId, itemUid, auth): MiniCart`; use case `removeCartItem` → `ok {cart}` | `invalid_cart` |
    `failed`, metric `CartRemoveItem{Outcome}`, never logs cart id/token, never recreates a cart; input
    `removeCartItemInputSchema` (cart id + token as the reads, base64 uid ≤256); action `removeCartItemAction` (same
    browser cart id/token as `getMiniCartAction`). The panel updates from the mutation response (as the PWA Apollo
    cache) and writes the count with `cartCountStore.set` (as add to cart). One removal at a time: every trash
    button is `aria-disabled` (the removing one also `aria-busy`, its row PWA `root_disabled`: `p-4`, #EAEBEB divider,
    50%) so focus is not lost; focus moves to the panel when the removed button goes away. Failure: the PWA shows a
    toast with Magento's message; Next has no toast system, so an inline `role="alert"` "No pudimos eliminar el
    artículo. Inténtalo de nuevo." stays in the panel and the row comes back. Accessible name "Eliminar {name}" (PWA
    "Eliminar"). No `CART_REMOVE_ITEM` analytics (Next has no analytics layer).
  - Panel: non-modal disclosure. ≥1160 (`min-[1160px]:`, PWA-parity exception to the DS 768/1024 rule) a
    `relative` container holds the trigger (`aria-expanded`, `aria-controls`, no `aria-haspopup`) and a `<section
    aria-label="Carrito">` at `absolute top-full right-0 z-[70] h-0`, fade 224ms `cubic-bezier(0,0,0.2,1)` in /
    192ms `cubic-bezier(0.4,0,1,1)` out (visibility transitions too, so the fade-out is visible; the PWA only
    transitions opacity), `inert` + `aria-hidden` when closed, reduced motion = no transition; contents 360px,
    `mt-3`, max 35rem, `radius-lg`, subtle border, elevation 3; height fitted to the viewport with the PWA 15px
    margin on open/resize; page scroll locked (`body` overflow) while open; Escape (inside, not already handled)
    closes, `preventDefault`s and focuses the trigger; pointer down outside closes; closes if the viewport drops
    below 1160. No backdrop, no close button. <1160 the trigger is a plain link to `/cart` (name "Carrito. Tienes N
    artículos en tu carrito.", starts with the visible label). Trigger look kept from T5 (icon 16/14, label from
    1024, badge below 1024); the PWA trigger differs (20px icon, label "Carrito (N)" only ≥1160, no badge, shows
    "(0)").
  - Content: head `px-4 pt-4 pb-3`, `items-baseline`, title 14/700/0.02em uppercase (no truncate), "Editar carrito"
    13/600 `ds-link` (disabled 50%, no href, while loading/removing). Stock message (PWA `StockStatusMessage`, es_MX
    text) only with an out-of-stock item: 4px #F87171 left border, 14/600 #B91C1C, 16px insets (venia red-400/700,
    legacy `xs` spacing = 1rem); the row-level "Agotado" is gone (the PWA row computes it but never renders it).
    Rows (legacy PWA `item.module.css`): `flex items-center justify-between mb-5`, no dividers; 80px `object-cover`
    4px image with `mb-4` in a product link (`tabIndex=-1`, `aria-hidden`: one link per product); info `mx-4`; name
    14/400 #333F47 leading 1, 2 lines; no option lines; "Cantidad: N" 12px #767B7F with the price stacked under it
    (12/700 #333F47, currency 12/400 via `formatToParts`); trash 32×32, 16px Feather `Trash2` (inline SVG: the DS
    icon catalog has no trash glyph and its test pins 50 icons), 1px #7E7E7E, 8px radius (pwa-ch-theme `md`),
    #959A9D, 50% (100% on keyboard focus). None of these grays has an identical DS token. Footer sticky `px-4 pt-3
    pb-4`, subtotal 15/700 with the price fading to 50% (384ms) while loading/removing; "Ir a pagar" `border-2!
    font-bold!` at the call site (the PWA high-priority style lives in a Venia Button override, not in the DS
    `atoms/Button`, so the shared Button stays as is), disabled while busy. Empty: only the centered message
    (no head/footer). First load: only the centered "Cargando tu carrito..." status; reopening keeps the last cart
    and fades the subtotal (PWA cache-and-network). Error + "Reintentar" kept (resilience extra; the PWA shows the
    empty message).
  - Changed assertions: mini cart "is the DS action": `aria-haspopup` `dialog` → null, plus `aria-expanded=false`
    and `aria-controls` → the panel. "opens the DS panel" → "opens a non-modal panel": `getByRole('dialog')` →
    `getByRole('region', {name: 'Carrito'})` (no dialog, no `aria-modal`), `Talla: M` present → absent, close
    button "Cerrar carrito" present/used → absent (toggle via the trigger), added image link/`object-cover`,
    "Eliminar Playera", CTA classes, closed panel `aria-hidden`. "marks an out-of-stock item…": "Agotado" present →
    absent, replaced by the PWA stock message. "Escape closes…": also asserts focus back on the trigger. "keeps the
    title and close button … while loading" → "shows only the centered status" (no heading, no close button).
    "shows the legacy empty message" → also no heading. Site header: `aria-haspopup` `dialog` → `aria-expanded`
    `false` + the `/cart` link. Integration `pdp.test.ts`: `<button … aria-haspopup="dialog" … data-slot="cart-trigger">`
    → `aria-expanded="false"`, plus `<a href="/cart" … data-slot="cart-link">`. E2E: `getByRole('dialog', {name:
    /^Carrito/})` → `getByRole('region', {name: 'Carrito'})`; added focus-back and a remove step (empty panel, count
    0). No assertion deleted without a replacement.
  - Unresolved parity note (visual check): the PWA `src/overrides/@magento/venia-ui/i18n/es_MX.json` still maps
    `miniCart.goToCheckout` → "Finalizar compra", `miniCart.subtotal` → "Subtotal: " and `productList.quantity` →
    "Cantidad : {quantity}"; if that file is loaded for the es_MX store, the live PWA shows those strings instead
    of the DS defaults ("Ir a pagar", "Subtotal (N art.):", "Cantidad: N") kept here.
  - Size: ~890 added / ~270 deleted incl. tests (remove end to end + restyle as one coherent work unit), over the
    400 heuristic, not split.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 118 files / 1138 tests pass;
    integration 7 files / 102 tests pass; build pass (`1160px`, `z-[70]`, `w-[360px]`, `border-2!`, `#7e7e7e` in the
    built CSS); dev server `/` 200 (not restarted). E2E spec typechecks and lints, not run (its global setup starts
    its own servers). Visual check pending (user): dropdown at 1160/1440 under the trigger, fade, rows vs the PWA,
    the trash button contrast (50% gray, PWA parity, under WCAG 1.4.11 3:1), long lists in the fitted height.
- [ ] T7b Account panel (avatar, name, items, sign-out in #BE424B). Pending: Next has no customer session yet (account pages stay on the PWA until phase 4).
- [x] T8 Price + product cards + product grids 2/5/5. Check: unit + visual.
  - Route: delegated, writer trigger 2+ non-trivial files. Test-first: baseline focused unit (page-builder, search,
    product, recommendations, category, shared) 70 files / 781 tests green; RED = 8 new test files, 3 failing to
    import (`@/shared/ui/{price,rating,product-card}` missing) and 11 of 12 surface tests failing (no shared grid/card
    slots, no slider card, no brand/rating on search results); GREEN = 78 files / 812 tests.
  - Files: `src/shared/ui/{price,rating,product-card}.tsx` (new), `src/modules/page-builder/ui/product-cards.tsx`,
    `src/modules/page-builder/ui/page-builder.module.css` (dead `.productGrid`/`.productCard`/`.productImage`/
    `.productName` removed), `src/modules/product/ui/{format-price.ts,magento-product-price.tsx,product-price.tsx,related-products.tsx}`,
    `src/modules/search/ui/search-page.tsx`, `src/modules/recommendations/ui/recommendation-sliders.tsx`; tests
    `tests/unit/shared/ui/{price,rating,product-card}.test.tsx`, `tests/unit/modules/{page-builder,product,category,search,recommendations}/ui/*.test.tsx` (new).
  - Live PWA sources: the redesign only re-skinned the Gallery item price (`Gallery/item.module.css`: offer
    `--ds-color-brand-anchor` #D84752, old price `--ds-color-text-tertiary` #AAAAAA, INTEGRATION-MAP row 23). The DS
    `molecules/ProductCard`, `atoms/Price` and `atoms/Rating` are only used by stories and a smoke test, never by a
    live page. Live card surfaces: `Gallery/item.js` (category, search, Page Builder `products` grid and carousel:
    the overridden `gallery.js` ignores the Page Builder `galleryItems` 5-column class and the Page Builder
    carousel renders `GalleryItem` without `viewMode`), `RandomSliders/ProductCard` (recommendation sliders, PDP
    Crossell/Upsell/Recommender) and the ChupaChoice `ProductList` (unchanged). The PWA PDP price did not change in
    the redesign: the PDP `ProductPrice` stays as is (only its dead `size="sm"` card variant removed).
  - Price (`Price`, variant `card`): `.cardDesktopPrice` block Inter 20px/1.5 bold #D84752 (`text-ds-accent`, same
    hex), offer `flex items-start justify-center min-h-[28px]`; compare-at only when `compareAt > amount` (today's
    rule: `getDisplayPrice` same-currency `regular > final`) as `<s>` `block min-h-[20px] text-center text-sm
    font-light text-ds-text-tertiary line-through`, "$" at 12px top aligned via `::first-letter` (the PWA styles the
    currency span `text-xs`; one text node keeps the amount assertions), sr-only "Antes:" before it. Variant
    `slider` (`RandomSliders/ProductCard`): row `flex flex-wrap items-baseline gap-[6px] mt-auto`, offer 15px 500
    #D84752, compare-at 11px #888 struck. `formatPrice` moved into `@/shared/ui/price` (es-MX, invalid-code
    fallback); `@/modules/product/ui/format-price` re-exports it. `MagentoProductPrice` takes `variant` (`pdp`
    default | `card` | `slider`) instead of `size`; the cards still render through it (render-isolation test).
  - Card (`ProductCard`, variant `gallery`): one `<a data-slot="product-card">` (plain anchor, same href, same alt
    `label ?? name`); grid layout `.cardDesktopGridBody` `grid grid-rows-[auto_3rem_1.5rem_1.75rem_1.25rem] gap-4
    items-start` (two children in five rows: card height = image + 184px); image box `aspect-square` flex centered,
    image `w-[80%]` full height `object-contain`, no radius/background; brand line Inter bold centered (search
    results have a brand; blank line otherwise); rating row `min-h-[24px]` with `ReviewStars` 20px, 2px gap,
    #FDAA40 (`ds-amber`) on #D1D5DB; name Roboto Flex (`font-display`) 16/400 centered, `min-h-[48px] pt-1`,
    2-line clamp; no hover style (the PWA has none; the old underline hover is gone). Carousel cards use `layout
    plain` (no grid rows, as the PWA Page Builder carousel). Variant `slider`: white card, 10px radius, padding
    10/12/12, shadow `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`, hover lift 2px + `0 4px 12px
    rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05)` 180ms (none with reduced motion), image square 6px radius
    (`rounded-xs`), info `pt-2`, stars 12px #F59E0B on #D1D5DB `mb-1`, name `h3` 12px/1.4 #1A1A1A 2 lines
    `min-h-[2.8em]`. Focus: 2px `ds-focus` outline, 2px offset (not in the PWA).
  - Grid (`ProductGrid`): live PWA `gallery.module.css` `.grid` = 2 columns below 800px (`-md` = max 799px), 4 from
    800px; column/row gap 8/24px, 16/32px from 1280px (`-xl` = max 1279px); `leading-none` from the Gallery root.
    Used by category, single-store search and related products (was 5 from 641px / 2/3/5 with `sm:`). Carousels
    keep their per-view counts (Page Builder track 2/4/5 at 641/961) since the redesign did not change them.
  - Deviations (recorded): grid 2/4 with 8–16/24–32 gaps instead of the DS `productColumns` 2/5/5 and gutters
    20/16/16 (the live listing still renders 2/4; INCONSISTENCIAS says Figma measured 5, `para-UX`). ChupaChoice
    kept as is (legacy `ProductList` replica, 2/3/6 with its `max-[359px]:` rules: the live PWA still renders it
    unchanged, so the shared card would break parity). One link per card instead of the PWA image + name links (one
    tab stop; the integration and search tests pin one link per product). No "Unknown Brand" placeholder (blank
    line kept). Stars clip one overlay to `value/5` (≤1px off the PWA per-star gradient because of the gaps; no
    SVG ids). Currency stays the Intl symbol of the source currency (the PWA always prints "$"). Known per-view
    gaps vs the live PWA, not changed (outside the redesign): Page Builder carousel PWA 2/3/4/5 at 640/960/1280 vs
    Next 2/4/5; recommendation sliders PWA 2/3/5 (embla, 10px gap, 1024) vs Next 2/4/5; the PWA has no
    related-products grid on the PDP (Next-only section, now on the Gallery card).
  - Changed assertions: none of the existing tests changed (product-cards rating, render, category, search,
    recommendations, PDP, structured data all pass unchanged). Search results now show their brand and stars
    (`showRating` on the single-store grid), so "shows no stars unless asked" still holds for CMS/category grids.
  - Size: 958 added / 189 deleted incl. ~470 test lines (three shared atoms + six surfaces as one work unit), over
    the 400 heuristic, not split.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 126 files / 1169 tests pass;
    integration 7 files / 102 tests pass; build pass (`min-width:800px`, `grid-rows-[auto_3rem…]`, `first-letter`,
    `1lh`, `#d1d5db` in the built CSS); dev server (not restarted): `/herramientas.html` 200 (1 product grid, 12
    shared cards, `$4,434.60`), `/search.html?query=test&store=amazon` 200 (1 grid, 26 cards, 10 compare-at
    prices). Visual check pending (user).
  - Carousel parity (2026-10-19, user decision "Igualalos a la PWA"; supersedes the per-view counts kept above):
    Page Builder carousel as the PWA react-slick `Products` settings
    (`node_modules/@magento/pagebuilder/lib/ContentTypes/Products/products.js:65-67,133-163`, breakpoints are
    `max-width` per `react-slick/lib/slider.js:126-158`, the last one `min-width: 1280px`; no gap between slides,
    `src/overrides/@magento/pagebuilder/lib/ContentTypes/Slider/slider.module.css:79-84`): 2 cards up to 640px, 3
    from 641px, 4 from 961px, 5 from 1280px, gap 0 (was 2/4/5 at 641/961, 1rem gap); image `sizes` follow (20/25/34/
    50vw). Recommendation sliders as the PWA `RandomSliders/ProductCarousel/productCarousel.module.css:44-65` (gap
    10px, slide `calc(20% - 8px)`, `-lg` = max 1023px → `calc(33.33% - 7px)`, `-sm` = max 639px → `calc(50% - 5px)`,
    screens in `packages/@chupaprecios/pwa-ch-theme/tailwind.preset.js:527-541`): 2 cards below 640px, 3 from 640px,
    5 from 1024px, via a `sliderCarousel` modifier on the shared track; skeleton grid 2/3/5 with a 10px gap; image
    `sizes` 20/34/50vw. Not ported (CSS-only scroll track, no client JS): the PWA embla arrows and dots, the CMS
    `data-show-arrows` slick arrows and the `continuous` center-mode peek. Test-first: RED 3 new tests failing
    (Page Builder per-view CSS + sizes, slider modifier + sizes, skeleton 2/3/5); GREEN. Changed assertions: none
    (new tests only).
- [x] T9 Recommendation sliders on embla, as the PWA (user, 2026-10-19: "con embla, igual que la PWA"). Visual review
  against the redesigned PWA on localhost:10000 found the search page scrolling sideways (document width
  2232–3379px at 375/1024/1440) because the CSS-only `overflow-x:auto` slider list does not contain its cards. Port the
  PWA `RandomSliders/ProductCarousel` (embla-carousel-react 8.6.0: `useCarousel.js`, `productCarousel.js` + its CSS):
  `overflow:hidden` viewport, arrows, dots, drag, same cards per view (2/3/5 at 640/1024, 10px gap), reduced motion.
  Scope: recommendation sliders only (Page Builder carousel is react-slick in the PWA and does not overflow; product
  gallery overflow at 375 is a separate follow-up). Route: delegated (writer trigger: 2+ non-trivial files).
  Check: unit (new embla slider behavior) + typecheck/lint/test/integration/build + no horizontal overflow on
  `/search.html?query=taladro&store=amazon` at 375/1024/1440.
  - Route: delegated (writer trigger: 2+ non-trivial files). Edit surface extended by the parent mid-task with
    `tests/unit/modules/recommendations/**` and `tests/unit/modules/page-builder/ui/product-cards.test.tsx` (Vitest
    only runs `tests/unit/**`; user approved).
  - Files: `src/modules/recommendations/ui/product-carousel.client.tsx` (new client island),
    `src/modules/recommendations/ui/recommendation-sliders.tsx`, `src/modules/page-builder/ui/{product-cards.tsx,
    page-builder.module.css}`, `package.json` + `pnpm-lock.yaml` (`embla-carousel-react` exactly `8.6.0`, as the PWA
    lockfile); tests `tests/unit/modules/recommendations/ui/product-carousel.client.test.tsx` (new),
    `tests/unit/modules/recommendations/recommendation-sliders.test.tsx`,
    `tests/unit/modules/page-builder/ui/product-cards.test.tsx`.
  - `ProductCarousel` wraps the server-rendered track (`ProductCards` `card="slider"` `<ul class=sliderCarousel>`,
    embla's container = the viewport's first child, slides = its `li`s) in an `overflow-hidden` viewport; the cards
    stay server-rendered, embla only enhances. Options exactly as `useCarousel.js`: `align:'start'`,
    `slidesToScroll:'auto'`, `containScroll:'trimSnaps'`, `loop: itemCount > 5`, breakpoints `(max-width: 640px)` →
    2 and `(min-width: 641px) and (max-width: 1024px)` → 3; no `dragFree`. Track `.sliderCarousel` is now its own
    flex list (PWA `.track`/`.slide`: gap 10px, `flex: 0 0 calc(50% - 5px)`, 33.33%-7px from 640px, 20%-8px from
    1024px), no longer a modifier of the Page Builder scroll track (`overflow-x:auto` grid), which stays CSS-only.
  - Arrows/dots as the PWA markup: prev/next `<button type="button">` before/after the viewport, disabled from
    `canScrollPrev`/`canScrollNext` (both disabled on the server and until embla starts), 40×64 white, 8px radius
    (`rounded-sm`), `text-ds-text`, shadow `0 2px 8px` 8%, hover `bg-ds-surface-subtle` + 12% shadow, disabled 40%
    opacity, at -12px (-8px below 1024px), hidden below 640px; chevron SVGs copied. Dots only with more than one
    snap, one per `scrollSnapList()` entry, `aria-label="Página N de M"`, 5px `bg-ds-neutral-300`, active 18×6px
    `bg-ds-accent` pill, 6px gap, `mt-4`; `data-active` marks the selected one. Skeleton (Suspense fallback) is
    the same carousel with 5 skeleton slides (PWA `.skeleton`: 10px radius, 0.5px border, padding 10/12/12, square
    image + 80%/50% lines), so the arrows show as in the PWA while loading.
  - Differences vs the PWA (intentional, recorded): arrow labels "Producto anterior" / "Siguiente producto" (the
    PWA passes a `<FormattedMessage>` element as `aria-label`, which renders `[object Object]`: PWA bug); reduced
    motion (Next-only): arrows and dots call embla with `jump=true`, dot/arrow transitions and skeleton pulse off;
    dots recount on `reInit` (the PWA counts once, stale after a breakpoint change); 2px `ds-focus` outline on the
    arrows. Copied as is: the embla breakpoints (640/641/1024) do not line up with the CSS cards-per-view
    breakpoints (639/640/1023/1024), so at exactly 640px and 1024px the scroll step and the visible cards differ;
    with `loop` on, the prev arrow is enabled from the start (PWA behavior).
  - Test-first: RED = new `product-carousel.client.test.tsx` failing to import (8 tests: viewport + arrows,
    options + loop, arrow clicks, disabled state from `select`, dots from `scrollSnapList` + click + selection,
    `reInit` recount, reduced-motion jump, server render) + 3 failing tests (slider track CSS, skeleton carousel,
    slider carousel markup); GREEN = focused 7 files / 43 tests.
  - Changed assertions (behavior intentionally changed): `product-cards.test.tsx` slider test: the slider `ul` no
    longer has `productCarousel`, and the `.productCarousel.sliderCarousel` `grid-auto-columns` + rule-order
    assertions became `.sliderCarousel` flex/gap/no-overflow and `.sliderCarousel > li` flex-basis 50%-5px /
    33.33%-7px / 20%-8px (the track is now the embla flex track). `recommendation-sliders.test.tsx` skeleton test:
    the `grid-cols-2/3/5` + `hidden`/`min-[…]:flex` assertions became 5 skeleton slides inside the carousel
    viewport with flex-basis classes and two disabled arrows (the PWA skeleton is the carousel).
  - Size: ~460 added / 66 deleted (≈260 test lines) + lockfile, over the 400 heuristic, one work unit, not split.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 127 files / 1181 tests pass;
    integration 7 files / 102 tests pass; build pass (dev server still 200 after it); overflow on the dev server
    (not restarted) `/search.html?query=taladro&store=amazon`: scrollWidth/innerWidth 375/375, 1024/1024,
    1440/1440 (was 2232–3379), sliders loaded with dots and enabled next arrows; screenshots
    `slider-{1440,375}-next-t9.png` in the session scratchpad. Visual check against the PWA pending (user).
- [x] T10 Product gallery horizontal overflow at 375 (visual review 2026-10-19; user: "sigamos con la galería de
  producto"). Cause: the gallery is a grid item with `min-width:auto`, so the six 80px thumbnails (6×80 + 5×8 =
  520px) widened the single mobile column; fix `min-w-0` on the gallery root (`product-gallery.tsx`). Route: inline
  (one mechanical file, cause understood). Test-first exception: jsdom has no layout, so RED/GREEN is the Playwright
  measure on the dev server (`/amazon-B00IJ0ALYS-…-dck240c2-.html`): before 536px at 375, after 375/1024/1440 equal
  to the viewport. Checks: typecheck, lint (1 existing warning), unit 1181, integration 102, build pass. Commit
  `9a20413` on `feat/ds-10-product-gallery` (stacked on `feat/ds-09-embla-sliders`, not pushed); assessed medium,
  `under_budget` (2 lines). User then granted a branch-wide review (vs `main`, includes T9): reliability lens
  approved and acknowledged (lineage `review-ecf75ba3caa0315b`), same three T9 suggestions only. T9 and T10 merged
  (PR #35 merge `6c56be6`).
- [x] T11 Layout parity with the redesigned PWA (visual review 2026-10-19 against localhost:10000; user: "dale").
  Route: delegated (writer trigger: 2+ non-trivial files). Scope:
  1. Page container on the canonical grid (1260 content / 1440 container, margins 20/30/90) instead of
     `max-w-[1280px] px-4` on category, search and CMS pages (and the product views' `max-w-6xl px-4`), so content
     lines up with the header (x=90 at 1440, x=20 at 375).
  2. "Mi cuenta" must not wrap at 1024 (the 1024 desktop switch stays, documented in T5).
  3. Store selector pill logos sized as the PWA `CHUP-redesign` source (live :10000 measured 90×28 at 375, 86px wide
     Amazon at 1440; Next 62×32 / 72px).
  4. Categories dropdown row text 16px as the PWA (Next 14px `text-body-md`); 36px rows and 8/12 padding unchanged.
  Out of scope: account/cart label sizes and red cart label (Figma Make spec, needs a decision), footer
  "Formas de pago" heading, T9 review test suggestions.
  Check: unit/integration where behavior or classes are asserted + typecheck/lint/test/integration/build + Playwright
  measure on the dev server (content x vs header x at 375/1024/1440; no "Mi cuenta" wrap at 1024; pill logo boxes;
  dropdown row font-size) and no horizontal overflow.
  - Route: delegated (writer trigger). Test-first: RED = 5 unit failures (category, search and CMS heading not on
    `container-padded`; pill logo `width`/`height` not the PWA boxes; "Mi cuenta" label without `whitespace-nowrap`)
    + 2 PDP integration failures (product `<article>` without `container-padded`, Magento and scraped views; a third
    test failed in cascade from the unawaited mutation); GREEN = all pass. Layout outcomes measured with Playwright.
  - Files: `category-page.tsx`, `search-page.tsx`, `cms-page.tsx` (content heading only; Page Builder rows keep their
    own widths), `magento-product-view.tsx`, `scraped-product-view.tsx` (`container-padded`, the header grid),
    `site-header.tsx` (label `whitespace-nowrap max-lg:sr-only`: Tailwind `not-sr-only` resets `white-space: normal`,
    which made "Mi cuenta" wrap at 1024; pill wrapper `min-w-0`), `store-selector.tsx` (PWA logo boxes),
    `search-form.module.css` (PWA pill values: 28px, padding 8 / min 56 up to 640px, then 12 / 72; the track is
    centered and scrolls inside itself, no visible scrollbar); tests `category-page-view`, `search-page-view`,
    `cms-page` (new), `search-form`, `site-header`, `integration/pdp`. No existing assertion changed (only additions).
  - PWA vs brief: item 4 needs no change. The live PWA row button computes 16px, but its visible text is the
    `categoryName` span at 14/20 (`categoriesDropdown.module.css`), the same as Next (14/20, 36px rows, 8/12 padding).
    The PWA pill track overflows the page at 375 (scrollWidth 433) and at 1024 (1204, mobile header there); Next
    scrolls inside the track instead. Acme keeps the PWA 50px box (its SVG declares 842x303 for 148x15 artwork, so
    the wordmark renders 50x5 in both).
  - Measured (before → after; PWA :10000): content x 16/16/96 → 20/90/90 at 375/1024/1440 on `/computo.html`,
    search and the DEWALT product (product h1 column before), equal to the header x 20/90/90; `scrollWidth` equals
    the viewport everywhere; "Mi cuenta" label 36 → 18px at 1024; pills at 375 62x32 each → 90/78/63/90/68 x28 (PWA
    identical); at 1440 98/72/72/72/72 → 98/86/72/98/76 x28 (PWA identical, Amazon 86); dropdown rows 14/20, 36px
    (PWA text 14/20). Screenshots `visual/<page>-<width>-next-t11.png`.
  - Open decision (user): at 1024 the row cannot hold the PWA pills (logo, Categorías, 454px track and actions need
    ~900px of the 844px content), so the track is 380px and scrolls, with the Acme pill almost fully hidden until
    ~1080px (at 375 Acme and part of Target are scrolled out, as off-page in the PWA). Alternatives: move the header
    switch to 1160 as the PWA, or accept the scroll. `product-skeleton.tsx` keeps `max-w-6xl px-4` (outside the
    edit surface), so the streamed PDP loading state is not yet on the grid.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 128 files / 1186 tests pass;
    integration 7 files / 102 tests pass; build pass; Playwright measure as above.
- [x] T11b Header desktop switch at 1160 like the PWA (user, 2026-10-19: "Desktop desde 1160", reverses the T5 1024
  switch; cart paths `mini-cart.client.tsx` + its test approved for the edit surface). Route: delegated (writer
  trigger: 2+ non-trivial files).
  - PWA source (`CHUP-redesign`): `wrapUseHeader.js` `MOBILE_BREAKPOINT = 1160`; `header.module.css`, `navTrigger`,
    `accountTrigger`, `cartTrigger`, `SignInButton` all switch at `min-width: 1160px`. Below it the tablet header:
    hamburger + "Categorías" label (from 768), centered 125px logo, icon-only actions, pills on their own centered
    row. Header side padding 20 / 32 (768) / 90 (1160). The search bar has no breakpoint (15px), so the Next 16 → 13px
    input switch at 1024 (T5 iOS zoom deviation) is not tied to the header switch and stays.
  - One definition: Tailwind `--breakpoint-desktop: 72.5rem` (`desktop:` variant, `globals.css`) and
    `DESKTOP_MEDIA_QUERY` (`src/shared/ui/breakpoints.ts`), checked against each other by a structural test. Header,
    drawer button + placeholder, drawer auto-close (`matchMedia`), categories dropdown + placeholder, "Mi cuenta",
    "Carrito" label/count and the mini-cart trigger/dropdown use it (the cart's `min-[1160px]` literals and
    `DROPDOWN_QUERY` literal are gone). Page grid unchanged. New `header-padded` utility = the grid container with the
    PWA 32px between 1024 and 1160 (header only); 768–1023 keeps the T1 30px (PWA header 32px there, left as is).
  - Test-first: RED = 6 failing tests + 1 file failing at import (`breakpoints.ts` missing); GREEN = 87/87 in the
    touched files. Changed assertions: `site-header.test.tsx` label class `max-lg:sr-only` → `max-desktop:sr-only`;
    breakpoint test now also forbids `lg:`/`max-lg:` in the header and requires `desktop:`; row-1 test drawer/dropdown
    closest `.lg:hidden`/`.hidden.lg:block` → `desktop:`; `nav-drawer.test.tsx` auto-close query `(min-width: 1024px)`
    → `(min-width: 1160px)`; `mini-cart.client.test.tsx` count parens `lg:before/after` → `desktop:`, link/container
    `min-[1160px]:hidden/flex` → `desktop:hidden/flex`. Added `tests/unit/shared/ui/breakpoints.test.ts`.
  - Measured (Playwright, `/search.html?query=taladro&store=amazon`): `scrollWidth === innerWidth` at 375, 1024,
    1159, 1160, 1440; pill track 454/454 (no in-row scroll) at 1024, 1159, 1160, 1440 (375: 413/335, scrolls as T11).
    1024 Next vs PWA: tablet header in both (hamburger + "Categorías", centered logo 125px at x 457 vs 472, icon-only
    actions, pills second row at x 285 in both, y 98 vs 87; header 165 vs 167px; content edge 32 in both). 1159 the
    same tablet header; 1160 and 1440 the desktop bar (logo x 90 width 136 in both, labels shown). Drawer opens at 1024
    and closes (body overflow restored) when resized to 1160. Screenshots `visual/header-<width>-next-t11b.png` and
    `header-{1024,1440}-pwa-t11b.png`.
  - Remaining differences (not in scope, T5 decisions): tablet bar vertical rhythm (PWA 16px bar padding, Next 12px),
    PWA tablet icons larger, desktop pill track x 540 vs 508 and search row y 111 vs 126 (PWA 1440 shows "Iniciar
    sesión" instead of "Mi cuenta", different action widths).
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 129 files / 1187 tests pass;
    integration 7 files / 102 tests pass; build pass (its "Invalid media query" CSS warning comes from the literal
    `min-[…]:flex` in this document's T9 entry, which Tailwind scans; pre-existing).
  - Review (2026-10-19): T11 + T11b range (400 lines, medium, `slice_budget_reached`), user granted; reliability
    lens approved and acknowledged (lineage `review-3449d4c49024ca49`). Advisory: WARNING `R3-store-track-scroll`
    (`search-form.module.css:22-23`, pill row scrolls with a hidden scrollbar; the PWA overflows the page instead),
    SUGGESTION `R3-skeleton-untested`. Merged in PR #36 (`386676f`).
- [x] T12 DS polish (user, 2026-10-19: "dale"). Route: delegated (writer trigger: 2+ non-trivial files). Scope:
  1. Footer "Formas de pago" heading above the payment logos, as the PWA `CHUP-redesign` source (copy, level,
     type and spacing from the source).
  2. Tests from the review suggestions: product loading skeleton on the page grid (T11 `R3-skeleton-untested`);
     carousel effect cleanup, reduced-motion listener and skeleton `loop` flag (T9 suggestions; fix the skeleton
     flag only if it really differs from the loaded carousel).
  3. Stop Tailwind from scanning `odd/**` (the "Invalid media query" build warning).
  Out of scope: account/cart label sizes and red cart label (needs a user decision), the hidden-scrollbar pill row
  warning (PWA overflows instead; needs a decision), header padding/x differences listed in T11b.
  Check: RED/GREEN for the new tests, typecheck/lint/test/integration/build with no CSS warning, footer screenshot
  at 375/1440 vs localhost:10000.
  - Files: `src/modules/layout/ui/site-footer.tsx`, `src/app/globals.css`; tests
    `tests/unit/modules/layout/ui/site-footer.test.tsx`, `tests/unit/modules/product/ui/product-skeleton.test.tsx`
    (new), `tests/unit/modules/recommendations/ui/product-carousel.client.test.tsx`,
    `tests/unit/modules/recommendations/recommendation-sliders.test.tsx`.
  - Footer: the payment logos list now sits in a `FooterColumn` titled "Formas de pago" (live PWA
    `overrides/.../Footer/footer.js` `.col` + `.colTitle`: 16px bold inverse, 8px bottom margin, 8px column gap,
    logos 4px top margin). Copy without the colon as the live PWA footer (the DS organism story has "Formas de
    pago:"). Kept `h2` like every other Next footer title (T3); the PWA uses `h3` for all of them.
  - Skeleton `loop` (verified, no code change): the skeleton passes 5 slides, so `loop` is false; the PWA loading
    carousel counts its children (none while loading), also false. The loaded carousel loops only past 5 cards in
    both. Same behavior, now pinned by a test.
  - Tailwind: `@source not '../../odd'` in `globals.css` (Tailwind 4.3.3; `@source not` exists since 4.1).
  - Test-first: RED = footer heading list + new "Formas de pago" test (2 failing); GREEN after the column. The
    skeleton container, reduced-motion change, unmount cleanup and skeleton loop tests pin existing behavior and
    passed on first run; a temporary mutation (dropping the reInit `off` and the media `change` listener) made the
    reduced-motion and cleanup tests fail, then the source was restored. Changed assertion: the footer `h2` list
    gains "Formas de pago" (new heading). The sliders test now mocks `embla-carousel-react` with a recorder that
    returns no API (as on the server), so the existing SSR assertions are unchanged.
  - Checks: typecheck pass; lint pass (0 errors, 1 pre-existing warning); unit 130 files / 1193 tests pass;
    integration 102 tests pass; build pass with no CSS or "Invalid media query" warning (dev server still 200).
    Playwright vs localhost:10000, heading at 375 and 1440: 16px / 700 / 24px line height / white / 8px margin,
    20px from the heading to the logos, 22px logos, identical to the PWA; x 1032 vs 1036 at 1440 (1260 vs 1280
    container, known contradiction). Screenshots `footer-{375,1440}-{next,pwa}-t12.png` in the session scratchpad.

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
- 2026-10-18: T2 commit `6e1f382` on `feat/ds-02-primitives` (stacked on T1, not pushed). Assessed medium
  (`slice_budget_reached`, 1172 lines: icon catalog + tests); user granted review; native review approved and
  acknowledged (lineage `review-b69e8d9adcb35b8f`) with one advisory WARNING carried into T3:
  R3-disabled-link-onclick (`src/shared/ui/button.tsx:144-149` spreads the caller `onClick` on a disabled/loading link).
- 2026-10-18: T3 done (DS footer, social glyphs in the DS Icon catalog, chupacredit/estafeta assets, disabled
  link `onClick` fix); all checks green, visual check pending.
- 2026-10-18: T3 commit `569f972` on `feat/ds-03-footer` (stacked on T2, not pushed). Assessed high (path match
  `payments/chupacredit.svg`); user granted review; four-lens native review approved and acknowledged (lineage
  `review-a3ba6a0b2adbb8f9`), suggestions only (follow-ups, not blocking): R2-001 stale `icon-catalog.ts` header
  comment (counts), R2-002 comment why the fourth footer column stacks service/offices/payments, R2-003 compose footer
  link classes with `cx`, R3-footer-social-icon-unproven (assert Instagram icon too), R3-disabled-link-click-nav
  (Enter on href-less anchor not exercised; unreachable).
- 2026-10-18: T4 done (rotating DS promo bar above the header, static content from the Magento block, server-rendered
  slides, pause on hover/focus, reduced motion); all checks green, visual check pending; WCAG 2.2.2 pause control
  open for a product decision.
- 2026-10-18: T4 commit `b60bf1a` on `feat/ds-04-promo-bar` (stacked on T3, not pushed). Assessed medium
  (`slice_budget_reached`); user granted review; native review approved and acknowledged (lineage
  `review-5ba5a2963af88388`), suggestions only (test follow-ups): R3-reduced-motion-change-unproved (live
  `matchMedia` change + cleanup untested), R3-slide-shrink-clamp-unproved, R3-cta-hover-focus-only-partial. Open
  decision for the user/UX: WCAG 2.2.2 pause control (the DS molecule has none).
- 2026-10-18: T5 done (DS two-row header, store pills as a radio group joined to the GET search form, search pill, DS
  wordmark, "Mi cuenta" / "Carrito (N)" actions); all checks green, visual check pending.
- 2026-10-18: T5 commit `af201ed` on `feat/ds-05-header-search` (stacked on T4, not pushed). Edit surface extended by
  the parent mid-task with `src/modules/cart/ui/mini-cart.client.tsx` (the cart trigger markup lives there; parent
  derivation gap, inside the authorized task). Assessed medium (`slice_budget_reached`); user granted review; native
  review approved with no findings and acknowledged (lineage `review-7f11df9f2c7b1058`). Follow-ups: delete unused
  `public/images/layout/cart.svg`; cart `aria-label` does not start with the visible "Carrito (N)" (WCAG 2.5.3).
- 2026-10-18: T6 done (desktop "Categorías" two-panel dropdown, light native-dialog drawer with drill-down below 1024,
  megamenu, scroller and `<details>` menu removed); all checks green, visual check pending.
- 2026-10-18: T6 commit `6fd60d3` on `feat/ds-06-categories-nav` (stacked on T5, not pushed). Assessed medium
  (`slice_budget_reached`, 1390 lines incl. deleted megamenu + tests); user granted review; native review approved and
  acknowledged (lineage `review-108e8b9fc7ff6077`) with three advisory WARNINGs and one SUGGESTION, carried into T7:
  R3-dropdown-escape-focus, R3-dropdown-blur-focus-null, R3-drawer-viewport-grow, R3-drawer-overflow-restore.
- 2026-10-18: T7a done (DS mini-cart panel: head title + "Editar carrito", item rows, footer subtotal + "Ir a pagar";
  T6 warnings fixed: prevented Escape ignored, blur to nothing closes, drawer closes at 1024, idempotent overflow);
  all required checks green, local e2e cart spec relabeled (not run), visual check pending.
- 2026-10-18: T7a commit `fc393ac` on `feat/ds-07-mini-cart` (stacked on T6, not pushed). Edit surface extended by the
  parent mid-task with `e2e/local/shared-cart.spec.ts` (relabel only; not run, its global setup starts its own
  servers). Assessed medium (`slice_budget_reached`); user granted review; native review approved with no findings and
  acknowledged (lineage `review-c948bd2ec5869d03`).
- 2026-10-18: T7c done (mini cart matched to the PWA: non-modal dropdown under the trigger from 1160, link to /cart
  below, legacy PWA rows with the trash button, stock message, head-less empty/loading; item removal end to end
  over Magento `removeItemFromCart` via a new server action); all required checks green, e2e updated (not run),
  visual check pending. Correction commit on `feat/ds-07-mini-cart` on top of `fc393ac` (not pushed); T8 next.
- 2026-10-18: T7c commit `4f1c268` on `feat/ds-07-mini-cart` (on top of T7a, not pushed). Assessed medium
  (`slice_budget_reached`, 1505 lines: removal end to end + restyle + tests); user granted review; native review
  approved with no findings and acknowledged (lineage `review-c78a73ae615c4c23`). To verify visually: the live PWA may
  render the es_MX override strings ("Finalizar compra", "Subtotal: ", "Cantidad : N") instead of the DS defaults kept
  here; trash button contrast at 50% opacity (WCAG 1.4.11).
- 2026-10-18: branches pushed; stacked PRs opened (user): #25 T1 (base `main`), #26 T2, #27 T3, #28 T4, #29 T5,
  #30 T6, #31 T7a+T7c (each based on the previous branch; GitHub retargets after each merge). Slices over 400 lines
  (#26, #28, #30, #31) are single work units, rationale in each PR's Chain Context. Merge in order.
- 2026-10-19: T8 done (shared `Price`, `Rating`, `ProductCard` and `ProductGrid` matched to the live PWA Gallery
  item and recommendation slider card; category, search, Page Builder products, related products and
  recommendation sliders use them; listing grid 2/4 as the live PWA, not the DS 2/5/5; ChupaChoice unchanged);
  all required checks green, visual check pending. Work-unit commit on `feat/ds-08-product-cards` (from `main`
  `c371707`, not pushed). T7b pending.
- 2026-10-19: T8 commit `3a5ca39` on `feat/ds-08-product-cards` (from `main` `c371707`, not pushed). Assessed medium
  (`slice_budget_reached`); user granted review; native review approved and acknowledged (lineage
  `review-d9b2e154b9490d5d`), suggestions only (Rating and Price invalid-input tests). Open decisions for the user:
  listing grid follows the live PWA 2/4 (DS/Figma say 5, `para-UX`).
- 2026-10-19: user decision "Igualalos a la PWA": carousel cards per view matched to the live PWA (Page Builder
  2/3/4/5 at 641/961/1280 with no gap; recommendation sliders 2/3/5 at 640/1024 with a 10px gap). Fix commit on
  `feat/ds-08-product-cards` on top of `00d39c3` (not pushed); visual check pending.
- 2026-10-19: T9 done (recommendation sliders on embla `8.6.0` as the PWA `RandomSliders/ProductCarousel`:
  `overflow:hidden` viewport, PWA options, arrows, dots, skeleton carousel; reduced motion jumps; no horizontal
  overflow on the search page at 375/1024/1440); all required checks green, visual check pending. Work-unit commit
  on `feat/ds-09-embla-sliders` (from `main` `e48a0fc`, not pushed).
- 2026-10-19: T9 commit `10d2ee1` plus `82b90d1` (`.gitignore` for the `AGENTS.md` written by `next dev`, user
  approved). Assessed medium (`slice_budget_reached`, 617 lines); user granted review; native review (reliability
  lens) approved and acknowledged (lineage `review-5490addf2e2d360c`), suggestions only: effect cleanup untested,
  reduced-motion listener untested, skeleton loop flag differs from the loaded carousel. Reviewed boundary: `82b90d1`.
  Next: user visual check of the sliders against localhost:10000; then the product gallery overflow at 375.
- 2026-10-19: T11 done (page content on the header grid, "Mi cuenta" on one line at 1024, PWA pill sizes with an
  in-track scroll, dropdown already at the PWA 14px text); all required checks green. Open: Acme pill hidden at 1024
  (switch at 1160 or accept the scroll) and the PDP skeleton container. Work-unit commit on
  `feat/ds-11-layout-parity` (from `main` `6c56be6`, not pushed).
- 2026-10-19: T11b done (user: "Desktop desde 1160"): one shared 1160 `desktop` breakpoint for the header, drawer,
  dropdown, account/cart labels and mini cart; tablet header up to 1159 as the PWA; header 32px margins at
  1024–1159; all required checks green. Work-unit commit on `feat/ds-11-layout-parity` (after `dfc22e0`, not pushed).
- 2026-10-19: T12 done: footer "Formas de pago" heading as the live PWA footer, review-suggestion tests (PDP
  skeleton on the page grid, carousel listener cleanup, reduced-motion change, skeleton loop matches the PWA),
  Tailwind no longer scans `odd/**` (no build CSS warning). All required checks green. Work-unit commit on
  `feat/ds-12-polish` (from `main` `386676f`, not pushed).
