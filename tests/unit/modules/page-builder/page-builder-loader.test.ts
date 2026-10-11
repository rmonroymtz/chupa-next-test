import { describe, expect, it, vi } from 'vitest';
import { createPageBuilderLoader } from '@/modules/page-builder/application/page-builder-loader';
import type { ProductsNode } from '@/modules/page-builder/domain/content-node';
import type { ProductListRepository } from '@/modules/product/application/ports';
import type { ProductCard } from '@/modules/product/domain/product';

const card = (urlKey: string): ProductCard => ({
  uid: urlKey,
  sku: urlKey,
  name: urlKey,
  urlKey,
  relativeUrl: `${urlKey}.html`,
  image: null,
  price: null,
  availability: 'in_stock',
});

const productsHtml = (appearance: string, keys: string[]) =>
  `<div data-content-type="products" data-appearance="${appearance}" data-element="main"><ol>${keys
    .map(
      (key) =>
        `<li class="product-item"><div class="product-item-details"><strong class="product-item-name"><a class="product-item-link" href="https://chupaprecios.com.mx/${key}.html">x</a></strong></div></li>`,
    )
    .join('')}</ol></div>`;

function setup(options: { products?: ProductListRepository; storeConfigFails?: boolean } = {}) {
  const logger = { warn: vi.fn(), error: vi.fn() };
  const storeConfig = {
    get: vi.fn(async () => {
      if (options.storeConfigFails) throw new Error('down');
      return { productUrlSuffix: '.html', baseMediaUrl: 'https://chupaprecios.com.mx/media/' };
    }),
  };
  const products: ProductListRepository = options.products ?? {
    findByUrlKeys: vi.fn(async (keys: readonly string[]) =>
      keys.filter((key) => key !== 'missing').map(card),
    ),
  };
  const loader = createPageBuilderLoader({ storeConfig, products, logger });
  return { loader, logger, storeConfig, products };
}

describe('PageBuilderLoader', () => {
  it('loads every products node with one Magento query, keeping each node order', async () => {
    const { loader, products, storeConfig } = setup();
    const view = await loader.load(
      productsHtml('grid', ['a-1', 'missing', 'b-2']) + productsHtml('carousel', ['b-2', 'c-3']),
      'cms:home',
    );
    const [grid, carousel] = view.document.nodes as ProductsNode[];
    expect(products.findByUrlKeys).toHaveBeenCalledTimes(1);
    expect(products.findByUrlKeys).toHaveBeenCalledWith(['a-1', 'missing', 'b-2', 'c-3']);
    expect(storeConfig.get).toHaveBeenCalledTimes(1);
    expect(view.productsFor(grid!).map((item) => item.uid)).toEqual(['a-1', 'b-2']);
    expect(view.productsFor(carousel!).map((item) => item.uid)).toEqual(['b-2', 'c-3']);
  });

  it('a product query failure leaves the cards empty and is logged, never thrown', async () => {
    const { loader, logger } = setup({
      products: { findByUrlKeys: vi.fn(async () => Promise.reject(new Error('down'))) },
    });
    const view = await loader.load(productsHtml('grid', ['a-1']), 'cms:x');
    expect(view.productsFor(view.document.nodes[0] as ProductsNode)).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x' }),
      'page builder products failed',
    );
  });

  it('uses the default .html suffix when storeConfig fails', async () => {
    const { loader, products } = setup({ storeConfigFails: true });
    await loader.load(productsHtml('grid', ['a-1']), 'cms:x');
    expect(products.findByUrlKeys).toHaveBeenCalledWith(['a-1']);
  });

  it('reads storeConfig only when the content needs it', async () => {
    const { loader, storeConfig, products } = setup();
    await loader.load('<div data-content-type="text"><p>a</p></div>', 'cms:x');
    expect(storeConfig.get).not.toHaveBeenCalled();
    expect(products.findByUrlKeys).not.toHaveBeenCalled();
  });

  it('resolves raw media directives and logs stripped ones once', async () => {
    const { loader, logger } = setup();
    const view = await loader.load(
      '<div data-content-type="text"><p><img src="{{media url=wysiwyg/a.png}}" alt="">{{widget type="x"}}</p></div>',
      'cms:x',
    );
    const text = view.document.nodes[0];
    expect(text?.type === 'text' && text.html).toContain(
      'src="https://chupaprecios.com.mx/media/wysiwyg/a.png"',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      { source: 'cms:x', directives: ['widget'] },
      'page builder directives stripped',
    );
  });

  it('keeps literal double-brace copy that is not a Magento directive', async () => {
    const { loader, logger } = setup();
    const view = await loader.load(
      '<div data-content-type="text"><p>Escribe {{text}} aquí</p></div>',
      'cms:x',
    );
    const text = view.document.nodes[0];
    expect(text?.type === 'text' && text.html).toBe('<p>Escribe {{text}} aquí</p>');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('never shows a directive whose quoted arguments contain `}` (resolver regex misses it)', async () => {
    const { loader, logger } = setup();
    const view = await loader.load(
      '<div data-content-type="text"><p>Hola {{widget template="a}b"}} mundo</p></div>',
      'cms:x',
    );
    const text = view.document.nodes[0];
    expect(text?.type === 'text' && text.html).toBe('<p>Hola  mundo</p>');
    expect(logger.warn).toHaveBeenCalledWith(
      { source: 'cms:x', directives: ['widget'] },
      'page builder directives stripped',
    );
  });

  it('logs unsupported content types once per page', async () => {
    const { loader, logger } = setup();
    await loader.load(
      '<div data-content-type="custom"></div><div data-content-type="custom"></div>',
      'cms:x',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { source: 'cms:x', warnings: ['unsupported content type: custom'] },
      'page builder content degraded',
    );
  });

  it('de-duplicates product cards per node, keeping first occurrence order', async () => {
    const { loader } = setup({
      products: {
        // `b-2-old` is a url rewrite alias of the same product as `b-2`.
        findByUrlKeys: vi.fn(async () => [
          card('a-1'),
          card('b-2'),
          { ...card('b-2'), urlKey: 'b-2-old' },
        ]),
      },
    });
    const view = await loader.load(
      productsHtml('grid', ['b-2', 'a-1', 'b-2', 'b-2-old', 'a-1']),
      'cms:x',
    );
    expect(
      view.productsFor(view.document.nodes[0] as ProductsNode).map((item) => item.uid),
    ).toEqual(['b-2', 'a-1']);
  });
});
