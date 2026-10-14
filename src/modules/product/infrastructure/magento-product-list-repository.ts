import 'server-only';
import type { ProductListRepository } from '@/modules/product/application/ports';
import type { ProductCard } from '@/modules/product/domain/product';
import {
  mapProductCard,
  type ProductCardDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import { PRODUCTS_BY_URL_KEYS_QUERY } from '@/modules/product/infrastructure/products-by-url-keys.query';
import { getMagentoClient, type MagentoClient } from '@/shared/graphql/client';

type Nullable<T> = T | null | undefined;

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
        const card = item ? mapProductCard(item) : null;
        if (card) byKey.set(card.urlKey, card);
      }
      // Legacy `restoreSortOrder`: admin order, unknown keys skipped.
      return urlKeys.flatMap((key) => byKey.get(key) ?? []);
    },
  };
}

export function getMagentoProductListRepository(): ProductListRepository {
  return createMagentoProductListRepository(getMagentoClient());
}
