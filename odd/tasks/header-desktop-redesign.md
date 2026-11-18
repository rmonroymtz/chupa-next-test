# Desktop header redesign (Figma 3460:4925)

Objective: bring the desktop header (from 1160 px, the `desktop:` variant) to the Figma proposal "Header" (file `yyiYug3ascAJYqOm3caRMv`, node `3460:4925`), keeping the mobile header as it is. Branch `feat/header-desktop-redesign` (from `main` `6af146d`). Delivery: ask-on-risk. Runner: vitest (`pnpm test`), integration, Playwright local stack.

## Specs

- S1 Main row (desktop). Logo on the left; the search block in the middle (store tabs on top, the search input under them, about 790 px wide); "Mi cuenta" and "Carrito (0)" on the right, aligned with the input. One search form, not duplicated; the store radios stay outside it, joined by `form="site-search"`. Mobile keeps its current layout.
- S2 Store tabs (desktop). The store selector looks like tabs attached to the search input: the checked store is outlined in the Figma orange `#ffa70f` and joins the input; the input has a `#ffa70f` border and an orange search button on its right. Assumption (L2): ChupaChoice stays as the first tab and the default store, because removing it would change where shoppers search.
- S3 Category bar (desktop). A full-width bar under the main row, with a top and bottom border, holding the current "Categorías" dropdown first (the only desktop access to subcategories until its new design exists) and then the Magento top-level categories as uppercase links to their category pages. User (L2): "Ahorita has algo sencillo para que se vean, aún no me comparten ese diseño". No chevrons, per-category dropdowns or active underline yet. With no menu, no bar.
- S4 Out of scope until defined (L2): "MARCA DEL MES", "OFERTAS" and "NUEVOS" (no target urls), the top bar text "Cotización empresarial en 24h · Crédito B2B y factura CFDI · Envío gratis desde $1,500" (marketing content of the promo bar), and the placeholder "Busca en Amazon, eBay, Target..." (the input is shared with mobile).

## Tasks

- [ ] T1 (S1, S2, S3) Header grid, store tabs and search field styles, category bar, tests and docs. Risk: none (layout only; the search GET parameters and the store radios do not change). Route: inline (one surface, shared files).

## Log

- L1 (2026-11-17) user: "vamos a empezar a actualizar el header me mandaron esta propuesta https://www.figma.com/design/yyiYug3ascAJYqOm3caRMv/Chupaprecios---Home-Redesign-2026?node-id=3460-4925&t=p4PM0G7BoUa1CVHM-4 es para desktop podemos ir aplicandola"
- L2 (2026-11-18) user, on the category list: "Ahorita has algo sencillo para que se vean, aún no me comparten ese diseño". Mapped by a read-only explorer: categories come from the Magento `HeaderMenu` query; the Figma names are not the Magento top level; the store selector is five native radios outside the form; tests pin the header DOM order and the radios.
