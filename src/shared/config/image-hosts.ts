/**
 * Remote image sources that `next/image` may optimize. Read at build time
 * from `IMAGE_REMOTE_HOSTS` (comma-separated `host` or `host/path/**`
 * entries, https only) because `images.remotePatterns` is fixed when Next
 * builds. Must stay free of framework and server-only imports: `next.config.ts`
 * imports it.
 */
export const DEFAULT_IMAGE_REMOTE_HOSTS: readonly string[] = Object.freeze([
  // Magento catalog media.
  'chupaprecios.com.mx/media/**',
  // Scraped vendor images (recorded CHAPI payloads).
  'i.ebayimg.com',
  'm.media-amazon.com',
  'target.scene7.com',
]);

export interface ImageRemotePattern {
  readonly protocol: 'https';
  readonly hostname: string;
  readonly pathname: string;
}

export function parseImageRemoteHosts(raw: string | undefined): ImageRemotePattern[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^https:\/\//i, ''))
    .filter((entry) => entry !== '');
  return (entries.length > 0 ? entries : DEFAULT_IMAGE_REMOTE_HOSTS).map(toPattern);
}

/** Shape accepted by `images.remotePatterns` in `next.config.ts`. */
export interface NextRemotePattern extends ImageRemotePattern {
  readonly search: '';
}

/**
 * Patterns for `images.remotePatterns`. `search: ''` only admits urls without
 * a query string: vendor CDNs use the query to resize or sign images, so any
 * query would let the optimizer fetch and store arbitrary variants.
 */
export function toNextRemotePatterns(patterns: readonly ImageRemotePattern[]): NextRemotePattern[] {
  return patterns.map((pattern) => ({ ...pattern, search: '' }));
}

/**
 * True when `next/image` can optimize the url under the given patterns, i.e.
 * it matches `toNextRemotePatterns` (https, host, path and no query string).
 * Anything else must render `unoptimized`, or the optimizer rejects it.
 */
export function isOptimizableImageUrl(
  url: string,
  patterns: readonly ImageRemotePattern[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.search !== '') return false;
  return patterns.some(
    (pattern) =>
      pattern.hostname === parsed.hostname.toLowerCase() &&
      matchesPathGlob(parsed.pathname, pattern.pathname),
  );
}

/** `/media/**` matches `/media` and anything below it, like Next's glob. */
function matchesPathGlob(pathname: string, glob: string): boolean {
  const prefix = glob.replace(/\/?\*\*$/, '');
  return prefix === '' || pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function toPattern(entry: string): ImageRemotePattern {
  const slash = entry.indexOf('/');
  const hostname = (slash === -1 ? entry : entry.slice(0, slash)).toLowerCase();
  const path = slash === -1 ? '' : entry.slice(slash).replace(/\/+$/, '');
  const pathname =
    path === '' || path === '/**' ? '/**' : path.endsWith('/**') ? path : `${path}/**`;
  return { protocol: 'https', hostname, pathname };
}
