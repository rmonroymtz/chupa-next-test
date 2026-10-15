/**
 * Links of the search page in the legacy url model
 * (`/search.html?query&store&page&storeParams`, decision 2). Pure domain code.
 *
 * CHAPI links (pagination, sort, refinements) travel as `storeParams` byte for
 * byte: `URLSearchParams` percent-encodes them and the route reads back the
 * exact same string. `page` is display only and never reaches CHAPI.
 */
import { SEARCH_PATH } from '@/modules/layout/domain/search';

export interface SearchLocation {
  readonly query: string;
  readonly store: string;
}

function searchHref(
  { query, store }: SearchLocation,
  page: string,
  storeParams: string | null,
): string {
  const params = new URLSearchParams({ query, store, page });
  if (storeParams !== null) params.set('storeParams', storeParams);
  return `${SEARCH_PATH}?${params.toString()}`;
}

/** A page of the results: `page` is the CHAPI link title, `storeParams` its link. */
export function pageLinkHref(location: SearchLocation, page: string, link: string): string {
  return searchHref(location, page, link);
}

/** A sort or refinement option: back to page 1 with the option's CHAPI link. */
export function storeParamsHref(location: SearchLocation, link: string): string {
  return searchHref(location, '1', link);
}

/** The same query in another store, from its first page and without CHAPI links. */
export function storeTabHref(query: string, store: string): string {
  return searchHref({ query, store }, '1', null);
}

/** The current search without any refinement or sort (`storeParams` dropped). */
export function clearFiltersHref({ query, store }: SearchLocation): string {
  return storeTabHref(query, store);
}
