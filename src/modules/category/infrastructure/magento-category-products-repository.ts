import 'server-only';
import type { CategoryProductsRepository } from '@/modules/category/application/ports';
import {
  mapCategoryProductPage,
  type CategoryProductsDto,
} from '@/modules/category/infrastructure/category-mapper';
import { CATEGORY_PRODUCTS_QUERY } from '@/modules/category/infrastructure/category-products.query';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

const OPERATION = 'CategoryProducts';

// Magento refuses a page beyond the last one of a non-empty result with
// `currentPage value 9 specified is greater than the 3 page(s) available.`
const PAGE_OUT_OF_RANGE =
  /^currentPage value \d+ specified is greater than the \d+ page\(s\) available\.?$/i;

interface CategoryProductsData {
  products: CategoryProductsDto | null;
}

interface CategoryProductsVariables extends Record<string, unknown> {
  uid: string;
  currentPage: number;
  pageSize: number;
}

/** Magento-backed repository: no-store, timeout and metrics come from the client. */
export function createMagentoCategoryProductsRepository(
  client: MagentoClient,
): CategoryProductsRepository {
  return {
    async findPage({ categoryUid, currentPage, pageSize }) {
      let data: CategoryProductsData;
      try {
        data = await client.request<CategoryProductsData, CategoryProductsVariables>({
          operationName: OPERATION,
          query: CATEGORY_PRODUCTS_QUERY,
          variables: { uid: categoryUid, currentPage, pageSize },
        });
      } catch (error) {
        if (isPageOutOfRange(error)) return { kind: 'out_of_range' };
        throw error;
      }
      const page = data.products ? mapCategoryProductPage(data.products) : null;
      if (!page) {
        throw new MagentoRequestError({
          kind: 'invalid_response',
          operation: OPERATION,
          message: 'Magento returned no products page info or total count',
        });
      }
      return { kind: 'page', page };
    },
  };
}

function isPageOutOfRange(error: unknown): boolean {
  return (
    error instanceof MagentoRequestError &&
    error.kind === 'graphql' &&
    error.graphqlMessages.length > 0 &&
    error.graphqlMessages.every((message) => PAGE_OUT_OF_RANGE.test(message.trim()))
  );
}
