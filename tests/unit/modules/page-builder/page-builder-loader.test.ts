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
    expect((await view.productsFor(grid!)).map((item) => item.uid)).toEqual(['a-1', 'b-2']);
    expect((await view.productsFor(carousel!)).map((item) => item.uid)).toEqual(['b-2', 'c-3']);
    expect(products.findByUrlKeys).toHaveBeenCalledTimes(1);
    expect(products.findByUrlKeys).toHaveBeenCalledWith(['a-1', 'missing', 'b-2', 'c-3']);
    expect(storeConfig.get).toHaveBeenCalledTimes(1);
  });

  it('resolves the view before the product query finishes, so the page can stream', async () => {
    let release: (cards: ProductCard[]) => void = () => undefined;
    const pending = new Promise<ProductCard[]>((resolve) => {
      release = resolve;
    });
    const { loader } = setup({ products: { findByUrlKeys: vi.fn(() => pending) } });
    // Resolves while the product query is still pending.
    const view = await loader.load(productsHtml('grid', ['a-1']), 'cms:x');
    const cards = view.productsFor(view.document.nodes[0] as ProductsNode);
    release([card('a-1')]);
    expect((await cards).map((item) => item.uid)).toEqual(['a-1']);
  });

  it('skips products the admin hides (display:none on the node or a row around it)', async () => {
    const { loader, products, storeConfig } = setup();
    const hidden = (html: string) =>
      html.replace('data-element="main"', 'data-element="main" data-pb-style="H1"');
    const view = await loader.load(
      '<style>#html-body [data-pb-style=H1]{display:none}</style>' +
        hidden(productsHtml('grid', ['a-1'])) +
        hidden(
          '<div data-content-type="row" data-element="main">' +
            productsHtml('grid', ['b-2']) +
            '</div>',
        ) +
        productsHtml('carousel', ['c-3']),
      'cms:x',
    );
    const [first, row, last] = view.document.nodes;
    expect(first?.box.hidden).toBe(true);
    expect(row?.box.hidden).toBe(true);
    expect((await view.productsFor(last as ProductsNode)).map((item) => item.uid)).toEqual(['c-3']);
    expect(products.findByUrlKeys).toHaveBeenCalledWith(['c-3']);
    expect(storeConfig.get).toHaveBeenCalledTimes(1);
  });

  it('still loads products inside an admin-hidden tab item: the renderer draws every tab panel', async () => {
    const { loader, products } = setup();
    const view = await loader.load(
      '<style>#html-body [data-pb-style=H1]{display:none}</style>' +
        '<div data-content-type="tabs" data-element="main"><ul data-element="navigation"><li>A</li></ul><div data-element="content">' +
        `<div data-content-type="tab-item" data-tab-name="A" data-element="main" data-pb-style="H1">${productsHtml('grid', ['a-1'])}</div>` +
        '</div></div>',
      'cms:x',
    );
    const item = view.document.nodes[0]?.children[0];
    expect(item?.type).toBe('tab-item');
    expect(item?.box.hidden).toBe(true);
    expect(
      (await view.productsFor(item!.children[0] as ProductsNode)).map((card) => card.uid),
    ).toEqual(['a-1']);
    expect(products.findByUrlKeys).toHaveBeenCalledWith(['a-1']);
  });

  it('reads nothing when every products node is hidden', async () => {
    const { loader, products, storeConfig } = setup();
    await loader.load(
      '<style>#html-body [data-pb-style=H1]{display:none}</style>' +
        productsHtml('grid', ['a-1']).replace(
          'data-element="main"',
          'data-element="main" data-pb-style="H1"',
        ),
      'cms:x',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(products.findByUrlKeys).not.toHaveBeenCalled();
    expect(storeConfig.get).not.toHaveBeenCalled();
  });

  it('a product query failure leaves the cards empty and is logged, never thrown', async () => {
    const { loader, logger } = setup({
      products: { findByUrlKeys: vi.fn(async () => Promise.reject(new Error('down'))) },
    });
    const view = await loader.load(productsHtml('grid', ['a-1']), 'cms:x');
    expect(await view.productsFor(view.document.nodes[0] as ProductsNode)).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x' }),
      'page builder products failed',
    );
  });

  it('uses the default .html suffix when storeConfig fails', async () => {
    const { loader, products } = setup({ storeConfigFails: true });
    const view = await loader.load(productsHtml('grid', ['a-1']), 'cms:x');
    await view.productsFor(view.document.nodes[0] as ProductsNode);
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

  it('never shows a directive whose quoted arguments contain `}`', async () => {
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
      (await view.productsFor(view.document.nodes[0] as ProductsNode)).map((item) => item.uid),
    ).toEqual(['b-2', 'a-1']);
  });
});
