/**
 * Product url keys for search results, replicated from the legacy storefront
 * (`convertChapiToMagento.js` and `encodeSkuForUrl`). The url is parsed back
 * by `parseProductUrl`, which only reads the vendor and sku segments; the
 * slug is decorative. Pure domain code.
 */
import { normalizeSku } from '@/modules/product/domain/product-url';

const ACME_VENDOR = 'acme';

/**
 * Sku segment of a product url: acme skus are unpadded base64url of their
 * UTF-8 bytes (the inverse of `decodeSkuSegment`); other vendors keep the
 * normalized sku as is, with a literal `|` for variant skus.
 */
export function encodeSkuSegment(sku: string, vendor: string): string {
  const normalized = normalizeSku(sku);
  if (vendor.toLowerCase() !== ACME_VENDOR) return normalized;
  const binary = Array.from(new TextEncoder().encode(normalized), (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * `{vendor}-{sku}-{slug}` where the slug is the legacy
 * `title.toLowerCase().replace(/[^a-z0-9]+/g, '-')` of the raw CHAPI title.
 */
export function buildSearchItemUrlKey(vendor: string, sku: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${vendor}-${encodeSkuSegment(sku, vendor)}-${slug}`;
}
