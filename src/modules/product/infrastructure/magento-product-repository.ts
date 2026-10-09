import 'server-only';
import type { MagentoProductRepository } from '@/modules/product/application/ports';
import {
  mapProductRoute,
  type ProductRouteDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import { PRODUCT_BY_ROUTE_QUERY } from '@/modules/product/infrastructure/product-by-route.query';
import { getMagentoClient, type MagentoClient } from '@/shared/graphql/client';

interface ProductByRouteData {
  route: ProductRouteDto | null;
}

/** Magento-backed repository. Client errors propagate unchanged. */
export function createMagentoProductRepository(client: MagentoClient): MagentoProductRepository {
  return {
    async findByRouteUrl(routeUrl) {
      const data = await client.request<ProductByRouteData, { url: string }>({
        operationName: 'ProductByRoute',
        query: PRODUCT_BY_ROUTE_QUERY,
        variables: { url: routeUrl },
      });
      return mapProductRoute(data.route, routeUrl);
    },
  };
}

/** Resolver/repository bound to the process-wide Magento client. */
export function getMagentoProductRepository(): MagentoProductRepository {
  return createMagentoProductRepository(getMagentoClient());
}
