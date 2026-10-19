import { use } from 'react';
import { storeParamsHref, type SearchLocation } from '@/modules/search/domain/search-links';
import type { SearchSortOption } from '@/modules/search/domain/search-result';

/** Legacy `productSortChapi`: these link values are Magento sorts, not CHAPI ones. */
const IGNORED_LINKS: ReadonlySet<string> = new Set(['price', 'position']);

const CONTROL =
  'flex h-10 items-center gap-2 rounded-xs border border-ds-neutral-400 bg-white px-3 text-sm';

/** Same box as the selector, shown while the sort options load (no layout shift). */
export function SearchSortPlaceholder() {
  return (
    <div
      data-search-sort="placeholder"
      aria-hidden="true"
      className={`${CONTROL} w-56 animate-pulse text-ds-text-secondary`}
    >
      Ordenar por
    </div>
  );
}

interface SearchSortProps {
  /** Must not reject (the page turns a failure into no options). */
  readonly options: Promise<readonly SearchSortOption[]>;
  readonly location: SearchLocation;
}

/**
 * Sort selector, streamed in its own Suspense boundary after the results.
 * A `<details>` menu of plain links (works without JavaScript): each option
 * goes back to page 1 with the option's CHAPI link as `storeParams`.
 * Renders nothing without options.
 */
export function SearchSort({ options, location }: SearchSortProps) {
  const sorted = use(options)
    .filter((option) => !IGNORED_LINKS.has(option.link))
    .toSorted((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
  if (sorted.length === 0) return null;
  const selected = sorted.find((option) => option.selected);

  return (
    <details data-search-sort="options" className="group relative">
      <summary className={`${CONTROL} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <span>
          Ordenar por{selected ? ': ' : ''}
          {selected ? <strong className="font-semibold">{selected.title}</strong> : null}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="ml-auto size-4 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-xs border border-ds-neutral-400 bg-white py-1 shadow-elevation-2">
        {sorted.map((option, index) => (
          <li key={`${index}-${option.link}`}>
            <a
              href={storeParamsHref(location, option.link)}
              aria-current={option.selected ? 'true' : undefined}
              className={`block px-4 py-2 text-sm hover:bg-ds-surface-subtle ${
                option.selected ? 'font-semibold text-ds-link' : ''
              }`}
            >
              {option.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
