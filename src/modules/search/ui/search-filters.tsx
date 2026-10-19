import {
  clearFiltersHref,
  storeParamsHref,
  type SearchLocation,
} from '@/modules/search/domain/search-links';
import type {
  SearchRefinement,
  SearchRefinementOption,
} from '@/modules/search/domain/search-result';

/** Options shown per group before "Mostrar más" (legacy filter list). */
const VISIBLE_OPTIONS = 5;

interface SearchFiltersProps {
  readonly refinements: readonly SearchRefinement[];
  readonly location: SearchLocation;
}

/**
 * Refinement groups (CHAPI `refinements`). Every option is a plain link to
 * page 1 with the option's CHAPI link; a checked option's link removes it.
 * Rendered twice by the page: a sidebar from `lg` and a `<details>` below it,
 * both without JavaScript (the hidden copy is `display: none`).
 */
function FilterGroups({ refinements, location }: SearchFiltersProps) {
  const anyChecked = refinements.some((group) => group.options.some((option) => option.checked));
  return (
    <div className="space-y-6">
      {anyChecked ? (
        <a
          href={clearFiltersHref(location)}
          className="inline-block text-sm font-semibold text-ds-link underline"
        >
          Limpiar filtros
        </a>
      ) : null}
      {refinements.map((group, groupIndex) => (
        <div key={`${groupIndex}-${group.title}`}>
          <h3 className="mb-2 text-sm font-semibold">{group.title}</h3>
          <OptionList options={group.options.slice(0, VISIBLE_OPTIONS)} location={location} />
          {group.options.length > VISIBLE_OPTIONS ? (
            <details
              // Open when a hidden option is applied, so it stays visible.
              open={group.options.slice(VISIBLE_OPTIONS).some((option) => option.checked)}
              className="group/more mt-1"
            >
              <summary className="cursor-pointer list-none py-1 text-sm font-semibold text-ds-link [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">Mostrar más</span>
                <span className="hidden group-open/more:inline">Mostrar menos</span>
              </summary>
              <OptionList options={group.options.slice(VISIBLE_OPTIONS)} location={location} />
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OptionList({
  options,
  location,
}: {
  readonly options: readonly SearchRefinementOption[];
  readonly location: SearchLocation;
}) {
  return (
    <ul className="space-y-1">
      {options.map((option, index) => (
        <li key={`${index}-${option.link}`}>
          <a
            href={storeParamsHref(location, option.link)}
            aria-current={option.checked ? 'true' : undefined}
            aria-label={option.checked ? `Eliminar filtro "${option.title}".` : undefined}
            className="group flex items-start gap-2 py-1 text-sm hover:text-ds-link"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-xs border ${
                option.checked
                  ? 'border-ds-cta bg-ds-cta text-white'
                  : 'border-ds-neutral-400 bg-white group-hover:border-ds-cta'
              }`}
            >
              {option.checked ? (
                <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor">
                  <path d="m3.5 8.5 3 3 6-7" strokeWidth="2" />
                </svg>
              ) : null}
            </span>
            <span className={option.checked ? 'font-semibold' : undefined}>{option.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Desktop sidebar (from `lg`). */
export function SearchFiltersSidebar(props: SearchFiltersProps) {
  return (
    <aside
      data-search-filters="desktop"
      aria-label="Filtros de productos"
      className="hidden lg:block"
    >
      <h2 className="mb-4 text-lg font-semibold">Filtros</h2>
      <FilterGroups {...props} />
    </aside>
  );
}

/** Collapsible copy for small screens (below `lg`). */
export function SearchFiltersDisclosure(props: SearchFiltersProps) {
  return (
    <details
      data-search-filters="mobile"
      className="group w-full rounded-xs border border-ds-neutral-400 lg:hidden"
    >
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Filtrar
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
      <div className="border-t border-ds-border-subtle p-4">
        <FilterGroups {...props} />
      </div>
    </details>
  );
}
