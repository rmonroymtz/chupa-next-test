import type { Category, CategoryProductPage } from '@/modules/category/domain/category';

export interface CategoryRepository {
  /**
   * Reads a category by Magento uid. Resolves null when Magento has no such
   * (enabled) category; rejects when Magento fails or answers an unusable
   * category, so an outage is never a 404.
   */
  findByUid(uid: string): Promise<Category | null>;
}

export interface CategoryProductsQuery {
  readonly categoryUid: string;
  /** 1-based. */
  readonly currentPage: number;
  readonly pageSize: number;
}

/**
 * - `page`: the requested page (no items and zero pages for an empty category);
 * - `out_of_range`: Magento refused a page beyond the last one.
 */
export type CategoryProductsResult =
  { readonly kind: 'page'; readonly page: CategoryProductPage } | { readonly kind: 'out_of_range' };

export interface CategoryProductsRepository {
  /** Rejects when Magento fails, so an outage is never an empty category. */
  findPage(query: CategoryProductsQuery): Promise<CategoryProductsResult>;
}
