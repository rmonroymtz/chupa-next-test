// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type { ProductCard } from '@/modules/product/domain/product';

const card = (overrides: Partial<ProductCard> = {}): ProductCard => ({
  uid: 'u1',
  sku: 'B0LAMP',
  name: 'Lámpara',
  urlKey: 'amazon-B0LAMP-lampara',
  relativeUrl: 'amazon-B0LAMP-lampara.html',
  image: { url: 'https://m.media-amazon.com/images/I/lamp.jpg', label: null },
  price: {
    final: { amount: 899.5, currency: 'MXN' },
    regular: { amount: 1299, currency: 'MXN' },
    discount: null,
  },
  availability: 'in_stock',
  ...overrides,
});

afterEach(() => {
  document.body.innerHTML = '';
});

function render(element: React.ReactElement) {
  document.body.innerHTML = renderToStaticMarkup(element);
  return document.body;
}

describe('ProductCards (shared card and grid)', () => {
  it('renders the grid as the shared PWA Gallery grid (2 / 4 columns)', () => {
    const body = render(<ProductCards cards={[card()]} appearance="grid" />);

    const list = body.querySelector('ul');
    expect(list?.dataset.slot).toBe('product-grid');
    expect(list?.className).toContain('min-[800px]:grid-cols-4');
    expect(list?.className).not.toContain('productGrid');
  });

  it('renders every card with the shared card, link, alt and the discounted price', () => {
    const body = render(<ProductCards cards={[card()]} appearance="grid" />);

    const link = body.querySelector<HTMLAnchorElement>('li > a');
    expect(link?.dataset.slot).toBe('product-card');
    expect(link?.getAttribute('href')).toBe('/amazon-B0LAMP-lampara.html');
    expect(link?.className).toContain('grid-rows-[auto_3rem_1.5rem_1.75rem_1.25rem]');
    expect(body.querySelector('img')?.getAttribute('alt')).toBe('Lámpara');
    expect(body.querySelector('[data-price="offer"]')?.textContent).toBe('$899.50');
    expect(body.querySelector('[data-price="compare-at"]')?.textContent).toBe('$1,299.00');
  });

  it('keeps the carousel track and its per-view columns, with plain (non-grid) cards', () => {
    const body = render(<ProductCards cards={[card()]} appearance="carousel" />);

    const list = body.querySelector('ul');
    expect(list?.dataset.slot).not.toBe('product-grid');
    expect(list?.className).toContain('productCarousel');
    const link = body.querySelector<HTMLAnchorElement>('li > a');
    expect(link?.dataset.slot).toBe('product-card');
    expect(link?.className).not.toContain('grid-rows-');
  });

  it('uses the recommendation slider card when asked', () => {
    const body = render(<ProductCards cards={[card()]} appearance="carousel" card="slider" />);

    expect(body.querySelector('li > a')?.className).toContain('rounded-[10px]');
    expect(body.querySelector('h3')?.textContent).toBe('Lámpara');
  });

  it('shows the brand of a card that has one', () => {
    const body = render(
      <ProductCards cards={[{ ...card(), brand: 'Philips' }]} appearance="grid" />,
    );

    expect(body.querySelector('[data-slot="product-card-brand"]')?.textContent).toBe('Philips');
  });
});
