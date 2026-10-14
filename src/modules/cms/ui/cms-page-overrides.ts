import type { ReactNode } from 'react';
import type { CmsPage } from '@/modules/cms/domain/cms-page';

export interface CmsPageOverrideProps {
  /** The Magento page (title, meta, content) the override replaces; free to use or ignore. */
  readonly page: CmsPage;
}

/** A Next page component (sync or async Server Component) that renders a CMS page. */
export type CmsPageOverride = (props: CmsPageOverrideProps) => ReactNode | Promise<ReactNode>;

/**
 * Next pages that replace the Magento content of a CMS page, keyed by the CMS
 * identifier Magento `route()` resolves (e.g. `venia-new-home` for `/`).
 * Magento still decides the redirect, 404 and metadata. A page whose
 * identifier is not here renders its Magento content. Register a page with
 * `['identifier', Component]`; it may compose `<CmsBlock identifier="..." />`.
 */
export const CMS_PAGE_OVERRIDES: ReadonlyMap<string, CmsPageOverride> = new Map<
  string,
  CmsPageOverride
>([]);
