import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PageBuilderView } from '@/modules/page-builder/application/page-builder-loader';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';
import { renderPageBuilder } from '@/modules/page-builder/ui/render';
import type { ProductCard } from '@/modules/product/domain/product';

// A nested component that throws while React renders it (not while
// renderPageBuilder builds the element tree), like a bad price or link.
vi.mock('@/modules/product/ui/magento-product-price', () => ({
  MagentoProductPrice: () => {
    throw new Error('price exploded');
  },
}));

vi.mock('@/modules/page-builder/ui/tabs.client', () => ({
  Tabs: () => {
    throw new Error('tabs exploded');
  },
}));

const card: ProductCard = {
  uid: 'a-1',
  sku: 'a-1',
  name: 'Lámpara',
  urlKey: 'a-1',
  relativeUrl: 'a-1.html',
  image: null,
  price: null,
  availability: 'in_stock',
};

const PRODUCTS =
  '<div data-content-type="products" data-appearance="grid" data-element="main"><ol><li class="product-item"><div class="product-item-details"><strong class="product-item-name"><a class="product-item-link" href="/a-1.html">x</a></strong></div></li></ol></div>';
const text = (value: string) =>
  `<div data-content-type="text" data-element="main"><p>${value}</p></div>`;

async function renderStream(html: string) {
  const view: PageBuilderView = { document: parsePageBuilder(html), productsFor: () => [card] };
  const onError = vi.fn();
  const stream = await renderToReadableStream(
    <>{renderPageBuilder(view, { source: 'test', logger: { error: vi.fn() } })}</>,
    { onError },
  );
  await stream.allReady;
  return { html: await new Response(stream).text(), onError };
}

describe('renderPageBuilder: per-node isolation during server rendering', () => {
  it('a throwing nested component drops only its top-level node', async () => {
    const { html, onError } = await renderStream(text('antes') + PRODUCTS + text('después'));
    expect(html).toContain('<p>antes</p>');
    expect(html).toContain('<p>después</p>');
    expect(html).not.toContain('Lámpara');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'price exploded' }),
      expect.anything(),
    );
  });

  it('a throwing client component (tabs) drops only its top-level node', async () => {
    const tabs =
      '<div data-content-type="tabs" data-element="main"><ul data-element="navigation"><li>A</li></ul><div data-element="content"><div data-content-type="tab-item" data-tab-name="A">x</div></div></div>';
    const { html, onError } = await renderStream(text('antes') + tabs + text('después'));
    expect(html).toContain('<p>antes</p>');
    expect(html).toContain('<p>después</p>');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'tabs exploded' }),
      expect.anything(),
    );
  });
});
