# DS redesign — port the chupaprecios-pwa design system

Status (2026-10-18): T1–T6 done (`a815c0e`, `6e1f382`, `569f972`, `b60bf1a`, `af201ed`, `6fd60d3`), reviews approved, not pushed; T7a done; T8 next (T7b pending).

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
- [ ] T7b Account panel (avatar, name, items, sign-out in #BE424B). Pending: Next has no customer session yet (account pages stay on the PWA until phase 4).
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
