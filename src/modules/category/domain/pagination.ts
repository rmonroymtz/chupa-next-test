/**
 * Which page links a category listing shows. Pure domain code: no framework
 * imports and no I/O.
 */

/** A page number, or `gap` for a run of collapsed pages (shown as an ellipsis). */
export type PaginationItem = number | 'gap';

/**
 * The first and last pages plus the current page and its neighbours; a run of
 * hidden pages becomes one `gap`, except a single page, which is shown
 * instead (a gap would take the same room). Empty when there is at most one
 * page, since there is nothing to paginate.
 */
export function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 1) return [];
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous === 2) items.push(previous + 1);
    else if (page - previous > 2) items.push('gap');
    items.push(page);
    previous = page;
  }
  return items;
}
