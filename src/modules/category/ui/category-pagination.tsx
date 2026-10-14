import { withPageParam } from '@/modules/category/domain/category-page-param';
import { paginationItems } from '@/modules/category/domain/pagination';
import { toLocation } from '@/modules/routing/domain/request-path';

interface CategoryPaginationProps {
  /** Clean category url (`/{url_path}{suffix}`). */
  readonly url: string;
  /** Request query string (no leading `?`); other parameters are kept in the links. */
  readonly search: string;
  readonly currentPage: number;
  readonly totalPages: number;
}

const LINK = 'flex h-10 min-w-10 items-center justify-center rounded px-3 text-sm';

/**
 * Server-rendered page links: `?page=N`, the first page being the clean
 * category url. Plain anchors: every page is a full server render (no
 * prefetching of Magento-backed pages). Nothing renders for a single page.
 */
export function CategoryPagination({
  url,
  search,
  currentPage,
  totalPages,
}: CategoryPaginationProps) {
  const items = paginationItems(currentPage, totalPages);
  if (items.length === 0) return null;
  const href = (page: number) => toLocation(url, withPageParam(search, page));

  return (
    <nav aria-label="Paginación" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {currentPage > 1 ? (
          <li>
            <a href={href(currentPage - 1)} className={`${LINK} hover:bg-neutral-inactive`}>
              Anterior
            </a>
          </li>
        ) : null}
        {items.map((item, index) => (
          <li key={item === 'gap' ? `gap-${index}` : item}>
            {item === 'gap' ? (
              <span aria-hidden="true" className={`${LINK} text-neutral-grey`}>
                …
              </span>
            ) : item === currentPage ? (
              <span aria-current="page" className={`${LINK} bg-brand-red font-semibold text-white`}>
                {item}
              </span>
            ) : (
              <a href={href(item)} className={`${LINK} hover:bg-neutral-inactive`}>
                {item}
              </a>
            )}
          </li>
        ))}
        {currentPage < totalPages ? (
          <li>
            <a href={href(currentPage + 1)} className={`${LINK} hover:bg-neutral-inactive`}>
              Siguiente
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
