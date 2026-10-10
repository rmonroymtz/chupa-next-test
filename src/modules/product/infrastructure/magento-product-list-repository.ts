import 'server-only';
import type { ProductListRepository } from '@/modules/product/application/ports';
import type { ProductCard } from '@/modules/product/domain/product';
import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';
import {
  mapAvailability,
  mapPrice,
  type PriceRangeDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import { PRODUCTS_BY_URL_KEYS_QUERY } from '@/modules/product/infrastructure/products-by-url-keys.query';
import { getMagentoClient, type MagentoClient } from '@/shared/graphql/client';

type Nullable<T> = T | null | undefined;

interface ProductCardDto {
  uid?: Nullable<string>;
  sku?: Nullable<string>;
  name?: Nullable<string>;
  url_key?: Nullable<string>;
  url_suffix?: Nullable<string>;
  stock_status?: Nullable<string>;
  small_image?: Nullable<{ url?: Nullable<string>; label?: Nullable<string> }>;
  price_range?: Nullable<PriceRangeDto>;
}

interface ProductsByUrlKeysData {
  products: Nullable<{ items?: Nullable<Nullable<ProductCardDto>[]> }>;
}

/** Magento-backed product list; client errors propagate unchanged. */
export function createMagentoProductListRepository(client: MagentoClient): ProductListRepository {
  return {
    async findByUrlKeys(urlKeys) {
      if (urlKeys.length === 0) return [];
      const data = await client.request<
        ProductsByUrlKeysData,
        { urlKeys: string[]; pageSize: number }
      >({
        operationName: 'ProductsByUrlKeys',
        query: PRODUCTS_BY_URL_KEYS_QUERY,
        variables: { urlKeys: [...urlKeys], pageSize: urlKeys.length },
      });
      const byKey = new Map<string, ProductCard>();
      for (const item of data.products?.items ?? []) {
        const card = item ? toCard(item) : null;
        if (card) byKey.set(card.urlKey, card);
      }
      // Legacy `restoreSortOrder`: admin order, unknown keys skipped.
      return urlKeys.flatMap((key) => byKey.get(key) ?? []);
    },
  };
}

function toCard(item: ProductCardDto): ProductCard | null {
  if (!item.uid || !item.sku || !item.name || !item.url_key) return null;
  return {
    uid: item.uid,
    sku: item.sku,
    name: item.name,
    urlKey: item.url_key,
    relativeUrl: `${item.url_key}${item.url_suffix ?? DEFAULT_PRODUCT_URL_SUFFIX}`,
    image: item.small_image?.url
      ? { url: item.small_image.url, label: item.small_image.label?.trim() || null }
      : null,
    price: mapPrice(item.price_range?.minimum_price),
    availability: mapAvailability(item.stock_status),
  };
}

export function getMagentoProductListRepository(): ProductListRepository {
  return createMagentoProductListRepository(getMagentoClient());
}
