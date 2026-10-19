import type { CmsPage as CmsPageModel } from '@/modules/cms/domain/cms-page';
import { PageBuilderContent } from '@/modules/page-builder/ui/page-builder-content';

interface CmsPageProps {
  readonly page: CmsPageModel;
}

/**
 * Magento CMS page. The visible heading is the admin's content heading; when
 * it is empty (most pages carry their own title in the content) the page
 * title is still exposed as a visually hidden h1 for assistive technology.
 */
export function CmsPage({ page }: CmsPageProps) {
  return (
    <div data-cms-identifier={page.identifier}>
      {page.contentHeading ? (
        <h1 className="container-padded pt-6 text-2xl font-semibold">{page.contentHeading}</h1>
      ) : (
        <h1 className="sr-only">{page.title}</h1>
      )}
      <PageBuilderContent content={page.content} source={`cms:${page.identifier}`} />
    </div>
  );
}
