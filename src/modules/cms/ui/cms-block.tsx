import 'server-only';
import { getCmsBlock } from '@/modules/cms/infrastructure/cms-block.composition';
import { PageBuilderContent } from '@/modules/page-builder/ui/page-builder-content';

interface CmsBlockProps {
  /** Magento CMS block identifier, e.g. `hero-slider-container`. */
  readonly identifier: string;
}

/**
 * Server Component that renders a Magento CMS block inside a Next page, e.g.
 * `<CmsBlock identifier="hero-slider-container" />` in a CMS page override.
 * A missing, disabled or empty block renders nothing. A Magento failure
 * rejects: outside a Suspense boundary the page answers 5xx instead of a
 * silent success without the block.
 */
export async function CmsBlock({ identifier }: CmsBlockProps) {
  const block = await getCmsBlock(identifier);
  if (!block || block.content.trim() === '') return null;
  return (
    <div data-cms-block={block.identifier}>
      <PageBuilderContent content={block.content} source={`cms-block:${block.identifier}`} />
    </div>
  );
}
