import type { CmsBlock } from '@/modules/cms/domain/cms-block';
import type { CmsPage } from '@/modules/cms/domain/cms-page';

export interface CmsPageRepository {
  /**
   * Reads a CMS page by identifier. Resolves null when Magento has no such
   * (enabled) page; rejects when Magento fails, so an outage is never a 404.
   */
  findByIdentifier(identifier: string): Promise<CmsPage | null>;
}

export interface HomePageSource {
  /**
   * Identifier of the CMS page Magento serves as the home
   * (`storeConfig.cms_home_page`); null when unset. Rejects when Magento fails.
   */
  getHomeIdentifier(): Promise<string | null>;
}

export interface CmsBlockRepository {
  /**
   * Reads a CMS block by identifier. Resolves null when Magento has no such
   * (enabled) block; rejects when Magento fails, so an outage is never served
   * as a page without the block.
   */
  findByIdentifier(identifier: string): Promise<CmsBlock | null>;
}

/**
 * Next page components that replace the Magento content of a CMS page, keyed
 * by the CMS identifier Magento `route()` resolves. Generic over the component
 * type so the application layer stays free of React.
 */
export interface CmsPageOverrides<TOverride> {
  /** The component registered for the identifier; null when none is. */
  find(identifier: string): TOverride | null;
}
