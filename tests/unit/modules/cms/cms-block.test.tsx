import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmsBlock as CmsBlockModel } from '@/modules/cms/domain/cms-block';
import { CmsBlock } from '@/modules/cms/ui/cms-block';
import { MagentoRequestError } from '@/shared/graphql/client';

const getCmsBlock = vi.hoisted(() =>
  vi.fn<(identifier: string) => Promise<CmsBlockModel | null>>(),
);

vi.mock('@/modules/cms/infrastructure/cms-block.composition', () => ({ getCmsBlock }));

// The Page Builder pipeline has its own tests; here it only echoes what it receives.
vi.mock('@/modules/page-builder/ui/page-builder-content', () => ({
  PageBuilderContent: ({ content, source }: { content: string; source: string }) => (
    <section data-source={source} dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const render = async (identifier: string) =>
  renderToStaticMarkup(<>{await CmsBlock({ identifier })}</>);

describe('CmsBlock', () => {
  // Braces matter: a function returned from beforeEach runs as its teardown.
  beforeEach(() => {
    getCmsBlock.mockReset();
  });

  it('renders the Magento block content through the Page Builder renderer', async () => {
    getCmsBlock.mockResolvedValue({
      identifier: 'top-banner-slider',
      title: 'Top Banner Slider',
      content: '<p>Envío gratis</p>',
    });

    const html = await render('top-banner-slider');

    expect(getCmsBlock).toHaveBeenCalledWith('top-banner-slider');
    expect(html).toBe(
      '<div data-cms-block="top-banner-slider"><section data-source="cms-block:top-banner-slider"><p>Envío gratis</p></section></div>',
    );
  });

  it('renders nothing when the block is missing or disabled', async () => {
    getCmsBlock.mockResolvedValue(null);
    expect(await render('gone')).toBe('');
  });

  it('renders nothing when the block content is blank', async () => {
    getCmsBlock.mockResolvedValue({ identifier: 'vacio', title: '', content: ' \n ' });
    expect(await render('vacio')).toBe('');
  });

  it('rejects when Magento fails, so the page answers 5xx instead of a silent success', async () => {
    getCmsBlock.mockImplementation(async () => {
      throw new MagentoRequestError({
        kind: 'http',
        operation: 'CmsBlocks',
        status: 503,
        message: 'Fake outage',
      });
    });
    await expect(CmsBlock({ identifier: 'top-banner-slider' })).rejects.toBeInstanceOf(
      MagentoRequestError,
    );
  });
});
