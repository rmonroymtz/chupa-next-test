import type { CategoryTree } from '@/modules/layout/domain/category-menu';

export interface CategoryTreeRepository {
  /** Rejects when Magento is unavailable. */
  getTree(): Promise<CategoryTree>;
}
