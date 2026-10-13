import type { CategoryTreeRepository } from '@/modules/layout/application/ports';
import { buildCategoryMenu, type MenuItem } from '@/modules/layout/domain/category-menu';

export interface LoadCategoryMenuDeps {
  readonly categories: CategoryTreeRepository;
  readonly logger: { warn(context: Record<string, unknown>, message: string): void };
}

/**
 * Header menu items. Never rejects: on any failure the header renders without
 * categories rather than breaking the page (the Magento client already logs
 * and meters the failed request).
 */
export async function loadCategoryMenu(deps: LoadCategoryMenuDeps): Promise<MenuItem[]> {
  try {
    return buildCategoryMenu(await deps.categories.getTree());
  } catch (error) {
    deps.logger.warn({ err: error }, 'header menu unavailable');
    return [];
  }
}
