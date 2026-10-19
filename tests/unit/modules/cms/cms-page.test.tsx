import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CmsPage as CmsPageModel } from '@/modules/cms/domain/cms-page';
import { CmsPage } from '@/modules/cms/ui/cms-page';

// The Page Builder pipeline has its own tests; here it only echoes what it receives.
vi.mock('@/modules/page-builder/ui/page-builder-content', () => ({
  PageBuilderContent: ({ content }: { content: string }) => (
    <section dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const page = (overrides: Partial<CmsPageModel> = {}): CmsPageModel => ({
  identifier: 'promociones',
  urlKey: 'promociones',
  relativeUrl: 'promociones',
  title: 'Promociones',
  contentHeading: null,
  content: '<p>Magento content</p>',
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
  pageLayout: null,
  ...overrides,
});

describe('CmsPage', () => {
  it('the content heading sits on the canonical grid container, aligned with the header', () => {
    const html = renderToStaticMarkup(<CmsPage page={page({ contentHeading: 'Ofertas' })} />);
    const heading = /<h1 class="([^"]*)">Ofertas<\/h1>/.exec(html)?.[1] ?? '';
    expect(heading.split(' ')).toContain('container-padded');
    expect(heading).not.toMatch(/max-w-|px-4/);
  });

  it('without a content heading the page title is a visually hidden h1', () => {
    const html = renderToStaticMarkup(<CmsPage page={page()} />);
    expect(html).toContain('<h1 class="sr-only">Promociones</h1>');
  });
});
