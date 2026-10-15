import { pageLinkHref, type SearchLocation } from '@/modules/search/domain/search-links';
import { searchPaginationModel } from '@/modules/search/domain/search-pagination';
import type { SearchPagination as Pagination } from '@/modules/search/domain/search-result';

interface SearchPaginationProps {
  readonly pagination: Pagination;
  /** Url `page` (display only). */
  readonly page: number | null;
  readonly location: SearchLocation;
}

// Same look as the category pagination.
const LINK = 'flex h-10 min-w-10 items-center justify-center rounded px-3 text-sm';

/**
 * Page links from CHAPI data: previous, the pages CHAPI links (it reports no
 * total), the current page and next. Each link carries its CHAPI link as
 * `storeParams` and its label as `page`. Plain anchors; nothing renders
 * without another page.
 */
export function SearchPagination({ pagination, page, location }: SearchPaginationProps) {
  const { prev, next, pages } = searchPaginationModel(pagination, page);
  if (pages.length === 0) return null;
  const link = (entry: { page: string; link: string }) =>
    pageLinkHref(location, entry.page, entry.link);

  return (
    <nav aria-label="Paginación" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {prev ? (
          <li>
            <a href={link(prev)} className={`${LINK} hover:bg-neutral-inactive`}>
              Anterior
            </a>
          </li>
        ) : null}
        {pages.map((entry, index) => (
          <li key={`${index}-${entry.page}`}>
            {entry.link === null ? (
              <span aria-current="page" className={`${LINK} bg-brand-red font-semibold text-white`}>
                {entry.page}
              </span>
            ) : (
              <a
                href={link({ page: entry.page, link: entry.link })}
                className={`${LINK} hover:bg-neutral-inactive`}
              >
                {entry.page}
              </a>
            )}
          </li>
        ))}
        {next ? (
          <li>
            <a href={link(next)} className={`${LINK} hover:bg-neutral-inactive`}>
              Siguiente
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
