import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';
import type { RecommendedProduct } from '@/modules/recommendations/domain/recommendation';

type Nullable<T> = T | null | undefined;

/** One `randomProducts.products` entry as Magento returns it. */
export interface RandomProductDto {
  sku?: Nullable<string>;
  image?: Nullable<string>;
  name?: Nullable<string>;
  price?: Nullable<number>;
  /** `0` when the product has no discount (staging, 2026-10-16). */
  regular_price?: Nullable<number>;
  review_stars?: Nullable<number>;
  store?: Nullable<string>;
  /** Url key with its suffix, without a leading slash, e.g. `amazon-B08JZHG6KT-….html`. */
  link?: Nullable<string>;
}

/**
 * Recommended products in Magento's order. Products without a sku, name, link
 * or positive price are skipped, and so are repeated skus (the slider keys
 * its cards by them).
 */
export function mapRandomProducts(
  products: Nullable<readonly Nullable<RandomProductDto>[]>,
  currency: string,
): RecommendedProduct[] {
  const seen = new Set<string>();
  return (products ?? []).flatMap((dto) => {
    const product = dto ? mapRandomProduct(dto, currency) : null;
    if (!product || seen.has(product.uid)) return [];
    seen.add(product.uid);
    return [product];
  });
}

function mapRandomProduct(dto: RandomProductDto, currency: string): RecommendedProduct | null {
  const sku = text(dto.sku);
  const name = text(dto.name);
  const relativeUrl = text(dto.link)?.replace(/^\/+/, '');
  const price = positive(dto.price);
  if (!sku || !name || !relativeUrl || price === null) return null;
  const regular = positive(dto.regular_price);
  const image = text(dto.image);
  return {
    uid: `${text(dto.store) ?? 'magento'}-${sku}`,
    sku,
    name,
    urlKey: relativeUrl.endsWith(DEFAULT_PRODUCT_URL_SUFFIX)
      ? relativeUrl.slice(0, -DEFAULT_PRODUCT_URL_SUFFIX.length)
      : relativeUrl,
    relativeUrl,
    image: image ? { url: image, label: null } : null,
    // Amounts are copied, never computed; the regular price only when it is higher.
    price: {
      final: { amount: price, currency },
      regular: { amount: regular !== null && regular > price ? regular : price, currency },
      discount: null,
    },
    availability: 'unknown',
    rating: positive(dto.review_stars),
  };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
