import type { RecommendationRepository } from '@/modules/recommendations/application/ports';
import {
  mapRandomProducts,
  type RandomProductDto,
} from '@/modules/recommendations/infrastructure/random-products-mapper';
import { RANDOM_PRODUCTS_QUERY } from '@/modules/recommendations/infrastructure/random-products.query';
import type { MagentoClient } from '@/shared/graphql/client';

type Nullable<T> = T | null | undefined;

interface RandomProductsData {
  randomProducts?: Nullable<{ products?: Nullable<Nullable<RandomProductDto>[]> }>;
}

export interface MagentoRecommendationRepositoryOptions {
  /** Short: the sliders stream after the results and hide on timeout. */
  readonly timeoutMs: number;
  /** Currency of the plain `price`/`regular_price` amounts (the store's `Content-Currency`). */
  readonly currency: string;
}

/** Magento `randomProducts` sliders (no-store and metered by the Magento client). */
export function createMagentoRecommendationRepository(
  client: MagentoClient,
  options: MagentoRecommendationRepositoryOptions,
): RecommendationRepository {
  return {
    async findRandom(type, limit) {
      const data = await client.request<RandomProductsData, { limit: number; type: string }>({
        operationName: 'GetRandomProducts',
        query: RANDOM_PRODUCTS_QUERY,
        variables: { limit, type },
        timeoutMs: options.timeoutMs,
      });
      return mapRandomProducts(data.randomProducts?.products, options.currency);
    },
  };
}
