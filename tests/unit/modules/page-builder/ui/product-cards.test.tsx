// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const CSS = readFileSync(
  join(process.cwd(), 'src/modules/page-builder/ui/page-builder.module.css'),
  'utf8',
).replace(/\s+/g, ' ');

/** The declarations of `selector` inside `@media (min-width: …)`, or top level when `minWidth` is null. */
function rule(selector: string, minWidth: number | null): string | undefined {
  const escaped = selector.replace(/\./g, '\\.');
  const block = `${escaped} \\{ ([^}]*) \\}`;
  const pattern =
    minWidth === null
      ? new RegExp(`(?:^|\\} |\\*/ )${block}`)
      : new RegExp(`@media \\(min-width: ${minWidth}px\\) \\{ ${block}`);
  return CSS.match(pattern)?.[1];
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

  it('shows the PWA Page Builder carousel cards per view: 2, 3 from 641px, 4 from 961px, 5 from 1280px, no gap', () => {
    const body = render(<ProductCards cards={[card()]} appearance="carousel" />);

    expect(body.querySelector('ul')?.className).not.toContain('sliderCarousel');
    expect(body.querySelector('img')?.getAttribute('sizes')).toBe(
      '(min-width: 1280px) 20vw, (min-width: 961px) 25vw, (min-width: 641px) 34vw, 50vw',
    );
    expect(rule('.productCarousel', null)).toContain('grid-auto-columns: 50%;');
    expect(rule('.productCarousel', null)).toContain('gap: 0;');
    expect(rule('.productCarousel', 641)).toContain('grid-auto-columns: calc(100% / 3);');
    expect(rule('.productCarousel', 961)).toContain('grid-auto-columns: 25%;');
    expect(rule('.productCarousel', 1280)).toContain('grid-auto-columns: 20%;');
  });

  it('shows the PWA recommendation slider cards per view: 2, 3 from 640px, 5 from 1024px, 10px gap', () => {
    const body = render(<ProductCards cards={[card()]} appearance="carousel" card="slider" />);

    // The embla track (PWA `.track` / `.slide`): its own flex list, not the Page Builder scroll track.
    expect(body.querySelector('ul')?.className).not.toContain('productCarousel');
    expect(body.querySelector('ul')?.className).toContain('sliderCarousel');
    expect(body.querySelector('img')?.getAttribute('sizes')).toBe(
      '(min-width: 1024px) 20vw, (min-width: 640px) 34vw, 50vw',
    );
    const track = rule('.sliderCarousel', null);
    expect(track).toContain('display: flex;');
    expect(track).toContain('gap: 10px;');
    expect(track).not.toContain('overflow');
    const slide = '.sliderCarousel > li';
    expect(rule(slide, null)).toContain('flex: 0 0 calc(50% - 5px);');
    expect(rule(slide, null)).toContain('min-width: 0;');
    expect(rule(slide, 640)).toContain('flex-basis: calc(33.33% - 7px);');
    expect(rule(slide, 1024)).toContain('flex-basis: calc(20% - 8px);');
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
