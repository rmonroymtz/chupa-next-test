// @vitest-environment jsdom
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it } from 'vitest';
import type { RecommendedProduct } from '@/modules/recommendations/domain/recommendation';
import { RecommendationSliders } from '@/modules/recommendations/ui/recommendation-sliders';

const card = (sku: string): RecommendedProduct => ({
  uid: `amazon-${sku}`,
  sku,
  name: `Producto ${sku}`,
  urlKey: `amazon-${sku}-producto`,
  relativeUrl: `amazon-${sku}-producto.html`,
  image: { url: `https://m.media-amazon.com/images/I/${sku}.jpg`, label: null },
  price: {
    final: { amount: 100, currency: 'MXN' },
    regular: { amount: 150, currency: 'MXN' },
    discount: null,
  },
  availability: 'unknown',
  rating: 4,
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RecommendationSliders cards', () => {
  it('renders the PWA recommendation slider card (shared card, slider variant)', async () => {
    const { prelude } = await prerender(
      <RecommendationSliders
        load={(type) => Promise.resolve(type === 'tendency' ? [card('B1')] : [])}
      />,
    );
    document.body.innerHTML = await new Response(prelude).text();

    const link = document.body.querySelector<HTMLAnchorElement>('[data-recommendation] li > a');
    expect(link?.dataset.slot).toBe('product-card');
    expect(link?.getAttribute('href')).toBe('/amazon-B1-producto.html');
    expect(link?.className).toContain('rounded-[10px]');
    expect(link?.querySelector('h3')?.textContent).toBe('Producto B1');
    expect(link?.querySelector('[data-price="offer"]')?.className).toContain('text-[15px]');
    expect(link?.querySelector('[data-price="compare-at"]')?.textContent).toBe('$150.00');
    expect(link?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Calificación: 4.0 de 5 estrellas',
    );
  });
});
