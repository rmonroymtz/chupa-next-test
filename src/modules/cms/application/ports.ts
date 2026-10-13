import type { CmsPage } from '@/modules/cms/domain/cms-page';

export interface CmsPageRepository {
  /**
   * Reads a CMS page by identifier. Resolves null when Magento has no such
   * (enabled) page; rejects when Magento fails, so an outage is never a 404.
   */
  findByIdentifier(identifier: string): Promise<CmsPage | null>;
}
