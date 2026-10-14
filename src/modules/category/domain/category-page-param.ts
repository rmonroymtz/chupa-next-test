/**
 * The `?page=N` query parameter of a category page (Venia's pagination
 * parameter). Pure domain code: no framework imports and no I/O.
 */

export const PAGE_PARAM = 'page';

/**
 * - `valid`: a page to render; `explicit` is false when the request has no
 *   `page` parameter (the first page);
 * - `invalid`: anything but one positive integer written without leading
 *   zeros (`abc`, `0`, `-1`, `1.5`, empty, repeated), which redirects to the
 *   clean category url.
 */
export type PageParam =
  | { readonly kind: 'valid'; readonly page: number; readonly explicit: boolean }
  | { readonly kind: 'invalid' };

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

/** Reads the page from a request query string (no leading `?`). */
export function parsePageParam(search: string): PageParam {
  const values = new URLSearchParams(search).getAll(PAGE_PARAM);
  if (values.length === 0) return { kind: 'valid', page: 1, explicit: false };
  const [value = ''] = values;
  if (values.length > 1 || !POSITIVE_INTEGER.test(value)) return { kind: 'invalid' };
  const page = Number(value);
  return Number.isSafeInteger(page) ? { kind: 'valid', page, explicit: true } : { kind: 'invalid' };
}

/** The query string without the page parameter, other parameters kept in order. */
export function withoutPageParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(PAGE_PARAM);
  return params.toString();
}
