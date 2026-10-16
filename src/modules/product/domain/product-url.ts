/**
 * Product URL rules replicated from the legacy PWA Studio storefront.
 *
 * Product URLs look like `/{vendor}-{sku}-{slug}.html`. Legacy parsing is
 * `urlKey.split('-')`: index 0 is the vendor and index 1 is the sku segment.
 * Variant skus are joined with a literal `|`, which may arrive percent-encoded
 * as `%7C`; Magento `route()` and the sitemaps use the literal form.
 *
 * Pure domain code: no framework imports and no I/O.
 */

export const DEFAULT_PRODUCT_URL_SUFFIX = '.html';

const SKU_SEPARATOR = '|';
const ACME_VENDOR = 'acme';
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const VARIANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export interface ParsedProductUrl {
  /** Lowercase vendor from the allow-list. */
  readonly vendor: string;
  /** Sku for `processSku(input: { sku, vendor })` and the scraper API. */
  readonly sku: string;
  /** Route url without the suffix, with a literal `|`. */
  readonly urlKey: string;
  /** Value for Magento `route(url:)`, with a literal `|`. */
  readonly routeUrl: string;
}

export interface ParseProductUrlOptions {
  /** Request query; only `var` (eBay variant id) is read, and only for eBay. */
  readonly searchParams?: URLSearchParams;
  /** Product URL suffix. Defaults to `.html`. */
  readonly suffix?: string;
  /** Lowercase vendor allow-list. */
  readonly vendors: readonly string[];
}

/**
 * Splits on `|`, trims each part and collapses the sku to its first part when
 * every part is identical (`X|X` → `X`).
 */
export function normalizeSku(sku: string): string {
  const parts = sku.split(SKU_SEPARATOR).map((part) => part.trim());
  const [first = ''] = parts;
  return parts.every((part) => part === first) ? first : parts.join(SKU_SEPARATOR);
}

/**
 * Decodes the sku segment of a product URL. acme segments are base64url
 * (`+`→`-`, `/`→`_`, no padding); other vendors are raw. Returns null when
 * the segment is empty or cannot be decoded.
 */
export function decodeSkuSegment(segment: string, vendor: string): string | null {
  const raw = vendor.toLowerCase() === ACME_VENDOR ? decodeBase64Url(segment) : segment;
  if (raw === null) return null;
  const sku = normalizeSku(raw);
  return isUsableSku(sku) ? sku : null;
}

/**
 * Converts a request pathname into the url sent to Magento `route(url:)`:
 * strips leading slashes, query and fragment, and percent-decodes once (so
 * `%7C` becomes a literal `|`). Returns null for empty input, malformed
 * percent-encoding or decoded control characters.
 */
export function toRouteUrl(pathname: string): string | null {
  const path = stripQueryAndFragment(pathname).trim().replace(/^\/+/, '');
  if (path === '') return null;
  const decoded = safeDecode(path);
  if (decoded === null || decoded === '' || CONTROL_CHARACTERS.test(decoded)) return null;
  return decoded;
}

/**
 * Parses a product pathname. Returns null when the path is not a product URL
 * (unknown vendor, wrong suffix, nested path, empty or undecodable sku).
 */
export function parseProductUrl(
  pathname: string,
  options: ParseProductUrlOptions,
): ParsedProductUrl | null {
  const suffix = options.suffix ?? DEFAULT_PRODUCT_URL_SUFFIX;
  const routeUrl = toRouteUrl(pathname);
  if (routeUrl === null || !routeUrl.endsWith(suffix)) return null;

  const urlKey = routeUrl.slice(0, routeUrl.length - suffix.length);
  if (urlKey.includes('/')) return null;

  const [vendorSegment = '', skuSegment = ''] = urlKey.split('-');
  const vendor = vendorSegment.toLowerCase();
  if (!options.vendors.includes(vendor)) return null;

  const decoded = decodeSkuSegment(skuSegment, vendor);
  if (decoded === null) return null;

  const sku = normalizeSku(
    vendor === VARIANT_VENDOR ? applyVariant(decoded, options.searchParams) : decoded,
  );
  return { vendor, sku, urlKey, routeUrl };
}

/**
 * Whether a Magento product sku belongs to a vendor product url. Magento
 * `route()` answers a placeholder product for any vendor-shaped url it does
 * not have (production `urllocator-external-placeholder`, staging
 * `VA11-GO-NA`), so the caller compares skus instead of trusting the type.
 *
 * Candidates are every prefix of the url key segments after the vendor joined
 * back with `-` (so skus containing `-`, and acme base64url segments
 * containing `-`, still match), each decoded like the sku segment, plus the
 * eBay `?var=` form. Comparison is case-insensitive on normalized skus.
 * Returns null when the path is not a vendor product url (Magento is trusted).
 */
export function matchesProductUrlSku(
  pathname: string,
  sku: string,
  options: ParseProductUrlOptions,
): boolean | null {
  const suffix = options.suffix ?? DEFAULT_PRODUCT_URL_SUFFIX;
  const routeUrl = toRouteUrl(pathname);
  if (routeUrl === null || !routeUrl.endsWith(suffix)) return null;

  const urlKey = routeUrl.slice(0, routeUrl.length - suffix.length);
  if (urlKey.includes('/')) return null;

  const [vendorSegment = '', ...segments] = urlKey.split('-');
  const vendor = vendorSegment.toLowerCase();
  if (!options.vendors.includes(vendor)) return null;

  const wanted = normalizeSku(sku).toLowerCase();
  if (wanted === '') return false;
  for (let length = 1; length <= segments.length; length += 1) {
    const decoded = decodeSkuSegment(segments.slice(0, length).join('-'), vendor);
    if (decoded === null) continue;
    const forms =
      vendor === VARIANT_VENDOR
        ? [decoded, applyVariant(decoded, options.searchParams)]
        : [decoded];
    if (forms.some((form) => normalizeSku(form).toLowerCase() === wanted)) return true;
  }
  return false;
}

/** Last url key segment of the header sku jump (`{vendor}-{sku}-search.html`). */
const SKU_SEARCH_SEGMENT = 'search';

export interface SkuSearchUrl {
  /** Lowercase vendor from the allow-list. */
  readonly vendor: string;
  /** Sku segment as typed (raw, or base64url for acme); may be empty. */
  readonly skuSegment: string;
}

/**
 * Matches the legacy header sku jump `/{vendor}-{sku}-search{suffix}`
 * (`useSearchBar.js` pushes `${store}-${query}-search.html` for a query that
 * looks like a sku). After decoding the path once, the url key must split on
 * `-` into exactly three segments: an allow-listed vendor (case-insensitive,
 * as for product urls), the sku segment (possibly empty; the caller decides
 * whether it is usable) and the literal lowercase `search`. Anything else,
 * such as a real product slug ending in `-search`, returns null.
 */
export function matchSkuSearchUrl(
  pathname: string,
  options: Pick<ParseProductUrlOptions, 'suffix' | 'vendors'>,
): SkuSearchUrl | null {
  const suffix = options.suffix ?? DEFAULT_PRODUCT_URL_SUFFIX;
  const routeUrl = toRouteUrl(pathname);
  if (routeUrl === null || !routeUrl.endsWith(suffix)) return null;

  const urlKey = routeUrl.slice(0, routeUrl.length - suffix.length);
  if (urlKey.includes('/')) return null;

  const segments = urlKey.split('-');
  if (segments.length !== 3 || segments[2] !== SKU_SEARCH_SEGMENT) return null;
  const [vendorSegment = '', skuSegment = ''] = segments;
  const vendor = vendorSegment.toLowerCase();
  return options.vendors.includes(vendor) ? { vendor, skuSegment } : null;
}

/**
 * Builds an absolute canonical URL. The result keeps a literal `|` (string
 * concatenation, not URL serialization, and `%7C` is normalized to `|`),
 * has no query string or fragment, and exactly one slash between the base
 * and the relative url. Throws when the base is not an http(s) URL.
 */
export function buildCanonicalUrl(baseUrl: string, relativeUrl: string): string {
  const base = new URL(baseUrl);
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(`Canonical base URL must use http or https: ${baseUrl}`);
  }
  const basePath = base.pathname.replace(/\/+$/, '');
  const path = stripQueryAndFragment(relativeUrl)
    .replace(/^\/+/, '')
    .replace(/%7c/gi, SKU_SEPARATOR);
  return `${base.origin}${basePath}/${path}`;
}

/** Only eBay URLs carry the `?var=` variant id (legacy PWA Studio behavior). */
const VARIANT_VENDOR = 'ebay';

function applyVariant(sku: string, searchParams: URLSearchParams | undefined): string {
  if (sku.includes(SKU_SEPARATOR)) return sku;
  const variantId = searchParams?.get('var')?.trim() ?? '';
  return VARIANT_ID_PATTERN.test(variantId) ? `${sku}${SKU_SEPARATOR}${variantId}` : sku;
}

function decodeBase64Url(segment: string): string | null {
  if (!BASE64URL_PATTERN.test(segment)) return null;
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function isUsableSku(sku: string): boolean {
  return (
    sku !== '' &&
    !CONTROL_CHARACTERS.test(sku) &&
    sku.split(SKU_SEPARATOR).every((part) => part !== '')
  );
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function stripQueryAndFragment(value: string): string {
  const end = value.search(/[?#]/);
  return end === -1 ? value : value.slice(0, end);
}
