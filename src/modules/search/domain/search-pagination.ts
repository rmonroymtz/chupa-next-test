/**
 * Which page links a CHAPI search result shows. Pure domain code.
 *
 * CHAPI reports no total of pages: only `prev`, `next` and links to a few
 * other pages (never the current one), each one an opaque link labeled with
 * its page number.
 */
import type { SearchPagination } from '@/modules/search/domain/search-result';

/** A page entry: its label (the `page` url parameter) and CHAPI link; null link = current page. */
export interface SearchPageEntry {
  readonly page: string;
  readonly link: string | null;
}

export interface SearchPaginationModel {
  readonly prev: { readonly page: string; readonly link: string } | null;
  readonly next: { readonly page: string; readonly link: string } | null;
  /** Numbered pages in order (current included), then non-numeric links in CHAPI order. */
  readonly pages: readonly SearchPageEntry[];
}

const PAGE_NUMBER = /^[1-9]\d{0,8}$/;

/**
 * @param displayPage The url `page` (display only, what the shopper clicked);
 *   CHAPI's `current` when absent.
 */
export function searchPaginationModel(
  pagination: SearchPagination,
  displayPage: number | null,
): SearchPaginationModel {
  const current = displayPage ?? pagination.current;
  const prev = pagination.prev
    ? { page: String(Math.max(1, current - 1)), link: pagination.prev }
    : null;
  const next = pagination.next ? { page: String(current + 1), link: pagination.next } : null;

  const numbered = new Map<number, string>();
  const named: SearchPageEntry[] = [];
  for (const { title, link } of pagination.links) {
    if (!PAGE_NUMBER.test(title)) {
      if (!named.some((entry) => entry.page === title)) named.push({ page: title, link });
      continue;
    }
    const page = Number(title);
    if (page !== current && !numbered.has(page)) numbered.set(page, link);
  }
  if (numbered.size === 0 && named.length === 0 && !prev && !next) {
    return { prev: null, next: null, pages: [] };
  }

  const pages: SearchPageEntry[] = [...numbered.entries(), [current, null] as const]
    .sort(([a], [b]) => a - b)
    .map(([page, link]) => ({ page: String(page), link }));
  return { prev, next, pages: [...pages, ...named] };
}
