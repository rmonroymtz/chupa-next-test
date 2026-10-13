import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createPageBuilderLoader } from '@/modules/page-builder/application/page-builder-loader';
import { PageBuilderContent } from '@/modules/page-builder/ui/page-builder-content';

const logger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));

// The CMS page renders through PageBuilderContent; wire it to the real loader
// with fake Magento ports to prove directives are resolved on that path.
vi.mock('@/modules/page-builder/infrastructure/page-builder.composition', () => ({
  getPageBuilderLogger: () => logger,
  getPageBuilderLoader: () =>
    createPageBuilderLoader({
      storeConfig: {
        get: async () => ({
          productUrlSuffix: '.html',
          baseMediaUrl: 'https://chupaprecios.com.mx/media/',
        }),
      },
      products: { findByUrlKeys: async () => [] },
      logger,
    }),
}));

describe('PageBuilderContent (CMS render path)', () => {
  it('resolves {{media}} directives and strips other directives before rendering', async () => {
    const element = await PageBuilderContent({
      content:
        '<div data-content-type="text" data-element="main"><p><img src="{{media url=wysiwyg/a.png}}" alt="a">{{widget type="x"}}</p></div>',
      source: 'cms:test',
    });
    const html = renderToStaticMarkup(<>{element}</>);
    expect(html).toContain('src="https://chupaprecios.com.mx/media/wysiwyg/a.png"');
    expect(html).not.toContain('{{');
    expect(logger.warn).toHaveBeenCalledWith(
      { source: 'cms:test', directives: ['widget'] },
      'page builder directives stripped',
    );
  });

  it('resolves directives in plain (non Page Builder) CMS html too', async () => {
    const element = await PageBuilderContent({
      content: '<p><img src="{{media url="wysiwyg/b.png"}}" alt="b"></p>',
      source: 'cms:plain',
    });
    expect(renderToStaticMarkup(<>{element}</>)).toContain(
      'src="https://chupaprecios.com.mx/media/wysiwyg/b.png"',
    );
  });
});
