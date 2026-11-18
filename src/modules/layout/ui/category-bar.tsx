import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { CategoriesDropdown } from './categories-dropdown.client';

/**
 * Full-width bar (Figma "Category Nav", node 3460:4936), from 1160 only: a hairline on top; the
 * header's own bottom border closes it, so the header stays closed when there is no bar.
 */
const BAR_CLASS = 'hidden border-t border-ds-border-subtle bg-ds-surface desktop:block';

/**
 * Desktop category bar (Figma "Header" 3460:4925, from 1160): the "Categorías"
 * dropdown first, the only desktop access to subcategories until their own
 * design exists, then the Magento top-level categories as links to their
 * category pages. The links scroll sideways inside the bar when they do not fit
 * (no visible scrollbar), so every category stays reachable and crawlable.
 * Nothing renders without categories.
 */
export function CategoryBar({ items }: { readonly items: readonly MenuItem[] }) {
  if (items.length === 0) return null;
  return (
    <div data-slot="category-bar" className={BAR_CLASS}>
      <div className="header-padded flex h-11 items-center gap-6">
        <CategoriesDropdown items={items} />
        <nav
          aria-label="Categorías principales"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex items-center gap-6">
            {items.map((item) => (
              <li key={item.id} className="shrink-0">
                <a
                  href={item.categoryHref}
                  className="block rounded-xs py-1 text-[13px] leading-[18px] whitespace-nowrap text-ds-text uppercase hover:text-ds-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** Same footprint as the bar while the menu streams in, so the page does not shift. */
export function CategoryBarPlaceholder() {
  return (
    <div aria-hidden="true" className={BAR_CLASS}>
      <div className="h-11" />
    </div>
  );
}
