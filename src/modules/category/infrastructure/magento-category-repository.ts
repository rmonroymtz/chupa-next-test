import 'server-only';
import type { CategoryRepository } from '@/modules/category/application/ports';
import { mapCategory, type CategoryDto } from '@/modules/category/infrastructure/category-mapper';
import { CATEGORY_BY_UID_QUERY } from '@/modules/category/infrastructure/category.query';
import { isMagentoMissingEntity } from '@/modules/cms/infrastructure/magento-missing-entity';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

const OPERATION = 'CategoryByUid';

interface CategoryByUidData {
  storeConfig?: { category_url_suffix?: string | null } | null;
  categoryList: (CategoryDto | null)[] | null;
}

/** Magento-backed repository: no-store, timeout and metrics come from the client. */
export function createMagentoCategoryRepository(client: MagentoClient): CategoryRepository {
  return {
    async findByUid(uid) {
      let data: CategoryByUidData;
      try {
        data = await client.request<CategoryByUidData, { uid: string }>({
          operationName: OPERATION,
          query: CATEGORY_BY_UID_QUERY,
          variables: { uid },
        });
      } catch (error) {
        // Some Magento versions answer a missing category with a GraphQL error.
        if (isMagentoMissingEntity(error)) return null;
        throw error;
      }
      if (!Array.isArray(data.categoryList)) {
        throw invalidResponse('Magento returned a null categoryList');
      }
      const [dto] = data.categoryList;
      // A missing or disabled category is an empty list.
      if (!dto) return null;
      // Without the store config the category url would silently lose its suffix.
      if (!data.storeConfig) throw invalidResponse('Magento returned a null storeConfig');
      const category = mapCategory(dto, data.storeConfig.category_url_suffix);
      if (!category)
        throw invalidResponse('Magento returned a category without uid, name or url_path');
      return category;
    },
  };
}

function invalidResponse(message: string): MagentoRequestError {
  return new MagentoRequestError({ kind: 'invalid_response', operation: OPERATION, message });
}
