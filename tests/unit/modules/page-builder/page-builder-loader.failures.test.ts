import { describe, expect, it, vi } from 'vitest';
import { createPageBuilderLoader } from '@/modules/page-builder/application/page-builder-loader';
import * as directives from '@/modules/page-builder/parser/directives';
import * as parser from '@/modules/page-builder/parser/parse-page-builder';
import * as urlKeys from '@/modules/page-builder/domain/product-url-keys';

vi.mock('@/modules/page-builder/parser/directives', { spy: true });
vi.mock('@/modules/page-builder/parser/parse-page-builder', { spy: true });
vi.mock('@/modules/page-builder/domain/product-url-keys', { spy: true });

const PRODUCTS =
  '<div data-content-type="products" data-appearance="grid" data-element="main"><ol><li class="product-item"><div class="product-item-details"><strong class="product-item-name"><a class="product-item-link" href="/a-1.html">x</a></strong></div></li></ol></div>';

function setup() {
  const logger = { warn: vi.fn(), error: vi.fn() };
  const products = { findByUrlKeys: vi.fn(async () => []) };
  const loader = createPageBuilderLoader({
    storeConfig: {
      get: async () => ({ productUrlSuffix: '.html', baseMediaUrl: 'https://m.test/media/' }),
    },
    products,
    logger,
  });
  return { loader, logger, products };
}

describe('PageBuilderLoader: never rejects', () => {
  it('a directive failure strips the directives, keeps the content and is logged', async () => {
    vi.mocked(directives.resolveDirectives).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loader, logger } = setup();
    const view = await loader.load(
      '<div data-content-type="text" data-element="main"><p>Hola {{widget type="x"}}</p></div>',
      'cms:x',
    );
    const node = view.document.nodes[0];
    expect(node?.type === 'text' && node.html).toBe('<p>Hola </p>');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x', err: expect.any(Error) }),
      'page builder directives failed',
    );
  });

  it('the fallback also strips directives whose quoted arguments contain `}`', async () => {
    vi.mocked(directives.resolveDirectives).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loader } = setup();
    const view = await loader.load(
      '<div data-content-type="text" data-element="main"><p>Hola {{widget template="a}b"}} mundo</p></div>',
      'cms:x',
    );
    const node = view.document.nodes[0];
    expect(node?.type === 'text' && node.html).toBe('<p>Hola  mundo</p>');
  });

  it('a parser failure yields an empty document and is logged', async () => {
    vi.mocked(parser.parsePageBuilder).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loader, logger } = setup();
    const view = await loader.load('<p>x</p>', 'cms:x');
    expect(view.document).toEqual({ isPageBuilder: false, nodes: [], warnings: [] });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x' }),
      'page builder parse failed',
    );
  });

  it('a url key failure leaves that node without cards and is logged', async () => {
    vi.mocked(urlKeys.toProductUrlKeys).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loader, logger, products } = setup();
    const view = await loader.load(PRODUCTS, 'cms:x');
    const node = view.document.nodes[0]!;
    expect(node.type).toBe('products');
    expect(node.type === 'products' && view.productsFor(node)).toEqual([]);
    expect(products.findByUrlKeys).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x' }),
      'page builder product keys failed',
    );
  });
});
