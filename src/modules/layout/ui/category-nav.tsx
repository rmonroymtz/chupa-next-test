import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';
import { CategoryNavScroller } from './category-nav-scroller.client';
import { ChevronDownIcon, MenuIcon } from './icons';

// Plain anchors only (full navigation, no Next prefetch), like every other
// internal link: the header is shared by Next and PWA Studio pages, and
// `next/link` would prefetch the (Magento-backed) category pages in view.
// See `legacy-routes.ts`.

const NAV_HEIGHT = 'h-12';

/**
 * Reserved desktop menu bar. Rendered while the menu streams in and when it
 * is unavailable, so the header keeps its height (no layout shift).
 */
export function DesktopCategoryNavPlaceholder() {
  return <div aria-hidden="true" className={`hidden lg:block ${NAV_HEIGHT}`} />;
}

/**
 * Legacy desktop megamenu: every level links to its category page; the
 * submenu opens on hover or keyboard focus, CSS only. The top level is one
 * line that scrolls horizontally when it does not fit, with side arrows added
 * by `CategoryNavScroller` (the links themselves stay server-rendered).
 */
export function DesktopCategoryNav({ items }: { readonly items: readonly MenuItem[] }) {
  if (items.length === 0) return <DesktopCategoryNavPlaceholder />;
  return (
    // `relative` here, not on the items or the scroller: submenus are
    // positioned against the nav, an ancestor of the scroll container, so its
    // overflow does not clip them, and they span the full width.
    <nav aria-label="Categorías" className="relative hidden lg:block">
      <CategoryNavScroller>
        {/* `w-max min-w-full` centers the items while they fit and starts them
            at the left edge once they overflow (plain `justify-center` would
            push the first items out of reach on the left). */}
        <ul className={`flex ${NAV_HEIGHT} w-max min-w-full items-stretch justify-center`}>
          {items.map((item) => (
            <li key={item.id} className="group flex shrink-0">
              <a
                href={item.categoryHref}
                className="inline-flex items-center gap-1 px-3 font-sans text-[0.9rem] whitespace-nowrap uppercase decoration-ds-amber decoration-2 group-focus-within:underline group-hover:underline"
              >
                {item.label}
                {item.children.length > 0 ? <ChevronDownIcon className="size-4" /> : null}
              </a>
              {item.children.length > 0 ? (
                <div className="invisible absolute inset-x-0 top-full z-50 border-t border-ds-border-subtle bg-white shadow-elevation-2 group-focus-within:visible group-hover:visible">
                  <ul className="container-padded grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-6 py-6">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <a href={child.categoryHref} className="font-semibold hover:underline">
                          {child.label}
                        </a>
                        {child.children.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm">
                            {child.children.map((leaf) => (
                              <li key={leaf.id}>
                                <a href={leaf.categoryHref} className="hover:underline">
                                  {leaf.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CategoryNavScroller>
    </nav>
  );
}

/** Same footprint as the mobile menu button while the menu streams in. */
export function MobileCategoryMenuPlaceholder() {
  return <span aria-hidden="true" className="size-10 shrink-0 lg:hidden" />;
}

/**
 * Legacy mobile navigation drawer as a native `<details>` disclosure (no JS).
 * The panel overlays the page below the header, so opening it shifts nothing.
 * Every level links to its category page.
 */
export function MobileCategoryMenu({ items }: { readonly items: readonly MenuItem[] }) {
  return (
    <details className="group/menu shrink-0 lg:hidden">
      <summary
        aria-label="Alternar panel de navegación"
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden"
      >
        <MenuIcon className="size-6" />
      </summary>
      <nav
        aria-label="Menú principal"
        className="absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto border-t border-ds-border-subtle bg-white shadow-elevation-2"
      >
        <ul className="divide-y divide-ds-border-subtle">
          {items.map((item) => (
            <li key={item.id}>
              {item.children.length > 0 ? (
                <details className="group/item">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                    {item.label}
                    <ChevronDownIcon className="size-4 transition-transform group-open/item:rotate-180" />
                  </summary>
                  <ul className="pb-2">
                    <li>
                      <a href={item.categoryHref} className="block px-8 py-2 font-semibold">
                        Ver todo
                      </a>
                    </li>
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <a href={child.categoryHref} className="block px-8 py-2">
                          {child.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <a href={item.categoryHref} className="block px-4 py-3">
                  {item.label}
                </a>
              )}
            </li>
          ))}
          <li>
            <a href={LEGACY_ROUTES.signIn} className="block px-4 py-3 font-semibold">
              Iniciar sesión
            </a>
          </li>
        </ul>
      </nav>
    </details>
  );
}
