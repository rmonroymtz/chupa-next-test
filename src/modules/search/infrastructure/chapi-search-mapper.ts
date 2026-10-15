import type { Availability, MagentoPrice } from '@/modules/product/domain/product';
import { DEFAULT_PRODUCT_URL_SUFFIX, normalizeSku } from '@/modules/product/domain/product-url';
import type { ChapiSearchResult } from '@/modules/search/application/ports';
import { buildSearchItemUrlKey } from '@/modules/search/domain/search-item-url';
import type {
  SearchItem,
  SearchLink,
  SearchPagination,
  SearchRefinement,
  SearchResult,
  SearchSortOption,
} from '@/modules/search/domain/search-result';

/**
 * Maps CHAPI search payloads (`POST /api/v1/search/` and
 * `/api/v1/search/sort_by`), following the recorded staging responses and
 * the legacy `convertChapiToMagento.js`.
 *
 * The page is only rejected when the envelope is unusable (no `data`, no
 * `products` list, no usable vendor). Unlike the legacy, which throws for the
 * whole response when one product has no price, bad items are skipped one by
 * one and counted in `skippedItems`; repeated skus keep their first item and
 * are counted apart in `duplicateItems`. Items whose card link would not
 * route (see `toLinkVendor`) are skipped too.
 */

/** Legacy hard-codes MXN; used only when an item carries no currency. */
const DEFAULT_CURRENCY = 'MXN';
// Vendors become the first segment of product urls, which are split on `-`.
const VENDOR_PATTERN = /^[a-z0-9]+$/;
const INVALID = { status: 'invalid' } as const;

export interface SearchResponseContext {
  /** CHAPI store the request was sent to (the requested store's service fallback). */
  readonly requestedStore: string;
  /** Vendors `parseProductUrl` routes (`PRODUCT_VENDORS`). */
  readonly vendors: readonly string[];
}

export function parseSearchResponse(
  payload: unknown,
  context: SearchResponseContext,
): ChapiSearchResult<SearchResult> {
  if (!isRecord(payload) || !isRecord(payload.data)) return INVALID;
  const { data } = payload;
  if (!Array.isArray(data.products)) return INVALID;

  const requestedStore = context.requestedStore.toLowerCase();
  const responding = (
    nonEmptyString(data.vendor) ??
    nonEmptyString(payload.vendor) ??
    requestedStore
  ).toLowerCase();
  // An unusable vendor string must not hide a usable page: treat it as the requested store.
  const vendor = VENDOR_PATTERN.test(responding) ? responding : requestedStore;
  const linkVendor = toLinkVendor(vendor, requestedStore, context.vendors);

  const items: SearchItem[] = [];
  const seen = new Set<string>();
  let skippedItems = 0;
  let duplicateItems = 0;
  for (const raw of data.products) {
    const item = linkVendor ? toItem(raw, linkVendor) : null;
    if (!item) skippedItems += 1;
    else if (seen.has(item.uid)) duplicateItems += 1;
    else {
      seen.add(item.uid);
      items.push(item);
    }
  }

  return {
    status: 'ok',
    data: {
      vendor,
      items,
      totalCount: toInteger(data.totalProducts) ?? 0,
      pagination: toPagination(data.pagination),
      refinements: toRefinements(data.refinements),
      sorts: toSorts(data.sorts),
      skippedItems,
      duplicateItems,
    },
  };
}

/**
 * Vendor used in card links: the responding vendor when product urls route
 * it, else the requested store when they do, else null (items are skipped,
 * since their links would not resolve).
 */
function toLinkVendor(
  vendor: string,
  requestedStore: string,
  vendors: readonly string[],
): string | null {
  if (vendors.includes(vendor)) return vendor;
  return vendors.includes(requestedStore) ? requestedStore : null;
}

/** `sort_by` answers `{ data: [{ title, link, selected }] }`. */
export function parseSortResponse(payload: unknown): ChapiSearchResult<SearchSortOption[]> {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return INVALID;
  return { status: 'ok', data: toSorts(payload.data) };
}

/** Null (skipped) without a sku, a visible title or a positive current price. */
function toItem(raw: unknown, vendor: string): SearchItem | null {
  if (!isRecord(raw)) return null;
  const asin = nonEmptyString(raw.asin);
  const rawTitle = nonEmptyString(raw.title);
  if (!asin || !rawTitle) return null;
  const sku = normalizeSku(asin);
  const name = toPlainText(rawTitle);
  const price = toPrice(raw.price);
  if (!sku || !name || !price) return null;

  const urlKey = buildSearchItemUrlKey(vendor, sku, rawTitle);
  return {
    uid: `${vendor}-${sku}`,
    sku,
    name,
    urlKey,
    relativeUrl: `${urlKey}${DEFAULT_PRODUCT_URL_SUFFIX}`,
    image: toImage(raw.image),
    price,
    availability: toAvailability(raw.stock_status),
    brand: nonEmptyString(raw.brand),
    rating: toRating(raw.reviews),
  };
}

/**
 * `final` is the current price; `regular` is the previous price only when it
 * is higher, else the current price. Amounts are copied, never computed.
 */
function toPrice(raw: unknown): MagentoPrice | null {
  if (!isRecord(raw)) return null;
  const current = toNumber(raw.current_price);
  if (current === null || current <= 0) return null;
  const before = toNumber(raw.before_price);
  const currency = nonEmptyString(raw.currency) ?? DEFAULT_CURRENCY;
  return {
    final: { amount: current, currency },
    regular: { amount: before !== null && before > current ? before : current, currency },
    discount: null,
  };
}

function toImage(raw: unknown): SearchItem['image'] {
  if (!isRecord(raw)) return null;
  const url = nonEmptyString(raw.src);
  if (!url) return null;
  const alt = nonEmptyString(raw.alt);
  return { url, label: alt ? toPlainText(alt) || null : null };
}

function toRating(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  const rating = toNumber(raw.rating);
  return rating !== null && rating > 0 ? rating : null;
}

function toAvailability(raw: unknown): Availability {
  const status = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (status === 'in_stock') return 'in_stock';
  if (status === 'out_of_stock') return 'out_of_stock';
  return 'unknown';
}

function toPagination(raw: unknown): SearchPagination {
  const pagination = isRecord(raw) ? raw : {};
  const current = toInteger(pagination.current);
  const totalPages = toInteger(pagination.totalPages);
  return {
    current: current !== null && current > 0 ? current : 1,
    totalPages: totalPages !== null && totalPages > 0 ? totalPages : null,
    next: opaque(pagination.next),
    prev: opaque(pagination.prev),
    links: toLinks(pagination.links),
  };
}

function toLinks(raw: unknown): SearchLink[] {
  return records(raw).flatMap((entry) => {
    const link = opaque(entry.link);
    const title = toPlainText(String(entry.title ?? ''));
    return link && title ? [{ title, link }] : [];
  });
}

function toRefinements(raw: unknown): SearchRefinement[] {
  return records(raw).flatMap((entry) => {
    const title = toPlainText(String(entry.title ?? ''));
    const options = records(entry.links).flatMap((option) => {
      const link = opaque(option.link);
      const optionTitle = toPlainText(String(option.title ?? ''));
      return link && optionTitle
        ? [{ title: optionTitle, link, checked: option.checked === true }]
        : [];
    });
    if (!title || options.length === 0) return [];
    return [{ title, type: nonEmptyString(entry.type) ?? '', options }];
  });
}

function toSorts(raw: unknown): SearchSortOption[] {
  return records(raw).flatMap((entry) => {
    const link = opaque(entry.link);
    const title = toPlainText(String(entry.title ?? ''));
    return link && title ? [{ title, link, selected: entry.selected === true }] : [];
  });
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Legacy `decodeAndStripHtml`: decodes entities first, then strips tags
 * (including entity-encoded ones), then collapses whitespace.
 */
function toPlainText(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith('#')) {
    const hex = entity[1] === 'x' || entity[1] === 'X';
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }
  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
}

/** Numbers or numeric strings (legacy `parseFloat`), finite only. */
function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(raw: unknown): number | null {
  const value = toNumber(raw);
  return value === null ? null : Math.trunc(value);
}

function nonEmptyString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/** Opaque CHAPI links are kept byte for byte; blank means none. */
function opaque(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

function records(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
