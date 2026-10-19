// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { RelatedProduct } from '@/modules/product/domain/product';
import { RelatedProducts } from '@/modules/product/ui/related-products';

const item = (index: number): RelatedProduct => ({
  uid: `r${index}`,
  sku: `ebay-${index}`,
  name: `Camisa ${index}`,
  relativeUrl: `ebay-${index}-camisa.html`,
  image: { url: `https://i.ebayimg.com/${index}.jpg`, label: index === 1 ? 'Camisa azul' : null },
  price: { amount: 450 + index, currency: 'MXN' },
});

afterEach(() => {
  document.body.innerHTML = '';
});

function render(items: readonly RelatedProduct[]) {
  document.body.innerHTML = renderToStaticMarkup(
    <RelatedProducts items={items} heading="Productos relacionados" />,
  );
  return document.body;
}

describe('RelatedProducts', () => {
  it('lists the products in the shared product grid with the shared card', () => {
    const body = render([item(1), item(2)]);

    const list = body.querySelector('ul');
    expect(list?.dataset.slot).toBe('product-grid');
    expect(list?.className).not.toContain('sm:grid-cols-3');
    const links = [...body.querySelectorAll<HTMLAnchorElement>('li > a')];
    expect(links.map((a) => a.dataset.slot)).toEqual(['product-card', 'product-card']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ebay-1-camisa.html',
      '/ebay-2-camisa.html',
    ]);
  });

  it('keeps the image alt (label, else name) and shows the price', () => {
    const body = render([item(1), item(2)]);

    expect([...body.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual([
      'Camisa azul',
      'Camisa 2',
    ]);
    expect(
      [...body.querySelectorAll('[data-price="offer"]')].map((node) => node.textContent),
    ).toEqual(['$451.00', '$452.00']);
    expect(body.querySelector('[data-price="compare-at"]')).toBeNull();
  });

  it('renders nothing without products', () => {
    expect(render([]).innerHTML).toBe('');
  });
});
