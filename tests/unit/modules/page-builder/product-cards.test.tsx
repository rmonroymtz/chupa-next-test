// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type { ProductCard } from '@/modules/product/domain/product';

const card = (rating: number | null): ProductCard & { readonly rating: number | null } => ({
  uid: 'amazon-B1',
  sku: 'B1',
  name: 'Taladro',
  urlKey: 'amazon-B1-taladro',
  relativeUrl: 'amazon-B1-taladro.html',
  image: null,
  price: null,
  availability: 'unknown',
  rating,
});

afterEach(() => {
  document.body.innerHTML = '';
});

function render(element: React.ReactElement) {
  document.body.innerHTML = renderToStaticMarkup(element);
  return document.body;
}

describe('ProductCards ratings', () => {
  it('shows no stars unless asked (CMS and search grids keep their look)', () => {
    const body = render(<ProductCards cards={[card(4.5)]} appearance="grid" />);

    expect(body.querySelector('[role="img"]')).toBeNull();
  });

  it('shows the rating as five stars filled up to the value, with an accessible label', () => {
    const body = render(<ProductCards cards={[card(4.4)]} appearance="carousel" showRating />);

    const stars = body.querySelector('[role="img"]');
    expect(stars?.getAttribute('aria-label')).toBe('Calificación: 4.4 de 5 estrellas');
    expect(stars?.querySelectorAll('svg')).toHaveLength(10);
    expect(stars?.querySelector<HTMLElement>('[data-rating-fill]')?.style.width).toBe('88%');
  });

  it('shows no stars for a card without a rating', () => {
    const body = render(<ProductCards cards={[card(null)]} appearance="carousel" showRating />);

    expect(body.querySelector('[role="img"]')).toBeNull();
  });
});
