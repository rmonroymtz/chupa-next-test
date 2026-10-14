/**
 * Request pathname and query from the optional catch-all route params. Pure
 * domain code: no framework imports and no I/O.
 */

/** The site root, served by the optional catch-all without segments. */
export const HOME_PATHNAME = '/';

/**
 * Next 16.4 passes catch-all segments percent-decoded to `generateMetadata`
 * but still encoded to the page (observed: `|` vs `%7C`). Normalizing each
 * segment to one encoded form gives both the same `cache()` key, and
 * `toRouteUrl` then decodes the path exactly once. The optional catch-all
 * passes no segments for `/`.
 */
export function toPathname(segments: readonly string[] | undefined): string {
  if (!segments || segments.length === 0) return HOME_PATHNAME;
  return `/${segments.map((segment) => encodeURIComponent(safeDecode(segment))).join('/')}`;
}

export function toSearch(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, entry);
    }
  }
  return params.toString();
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // Already decoded and holds a literal `%`.
  }
}
