import { SEARCH_STORES } from '@/modules/layout/domain/search';
import { storeTabHref } from '@/modules/search/domain/search-links';

/** Store color of the current tab (same tokens as the header search bar). Literal classes for Tailwind. */
const CURRENT_TAB: Readonly<Record<string, string>> = {
  chupachoice: 'border-marketplace-chupachoice',
  amazon: 'border-marketplace-amazon',
  ebay: 'border-marketplace-ebay',
  target: 'border-marketplace-target',
  acme: 'border-marketplace-acme',
};

interface SearchStoreTabsProps {
  readonly query: string;
  readonly store: string;
}

/**
 * The same search in each store, in the header's order and labels. Plain
 * links: a tab is a new server search from page 1, without CHAPI links of
 * the current store. Scrolls sideways on narrow screens.
 */
export function SearchStoreTabs({ query, store }: SearchStoreTabsProps) {
  return (
    <nav aria-label="Tiendas" className="mt-4 border-b border-neutral-inactive">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {SEARCH_STORES.map((entry) => {
          const current = entry.id === store;
          return (
            <li key={entry.id} className="shrink-0">
              <a
                href={storeTabHref(query, entry.id)}
                aria-current={current ? 'page' : undefined}
                className={`flex h-10 items-center border-b-[3px] px-4 text-sm whitespace-nowrap ${
                  current
                    ? `${CURRENT_TAB[entry.id] ?? 'border-brand-red'} font-semibold text-neutral-black`
                    : 'border-transparent text-neutral-grey hover:text-neutral-black'
                }`}
              >
                {entry.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
