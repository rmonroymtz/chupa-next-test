// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductCard, ProductGrid } from '@/shared/ui/product-card';

afterEach(cleanup);

const IMAGE = { src: 'https://m.media-amazon.com/images/I/B1.jpg', alt: 'Taladro rojo' };

const card = (props: Partial<React.ComponentProps<typeof ProductCard>> = {}) => (
  <ProductCard
    href="/amazon-B1-taladro.html"
    name="Taladro inalámbrico"
    image={IMAGE}
    imageSizes="50vw"
    price={<span data-testid="price">$1,299.00</span>}
    {...props}
  />
);

describe('ProductCard (PWA Gallery item)', () => {
  it('is one link to the product with the image alt, the name and the price', () => {
    render(card());

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/amazon-B1-taladro.html');
    expect(links[0]?.dataset.slot).toBe('product-card');
    expect(screen.getByRole('img', { name: 'Taladro rojo' })).toBeTruthy();
    expect(screen.getByText('Taladro inalámbrico')).toBeTruthy();
    expect(screen.getByTestId('price').textContent).toBe('$1,299.00');
  });

  it('uses the Gallery geometry: square image box, 80% contained image, two-line centered name', () => {
    const { container } = render(card());

    const box = container.querySelector<HTMLElement>('[data-slot="product-card-image"]');
    expect(box?.className).toContain('aspect-square');
    expect(box?.firstElementChild?.className).toContain('w-[80%]');
    expect(container.querySelector('img')?.className).toContain('object-contain');
    const name = screen.getByText('Taladro inalámbrico');
    expect(name.className).toContain('line-clamp-2');
    expect(name.parentElement?.className).toContain('text-center');
    expect(name.parentElement?.className).toContain('font-display');
    expect(name.parentElement?.className).toContain('min-h-[48px]');
  });

  it('lays a grid card out with the Gallery grid rows; a carousel card has none', () => {
    const { rerender } = render(card({ layout: 'grid' }));
    expect(screen.getByRole('link').className).toContain(
      'grid-rows-[auto_3rem_1.5rem_1.75rem_1.25rem]',
    );

    rerender(card({ layout: 'plain' }));
    expect(screen.getByRole('link').className).not.toContain('grid-rows-');
  });

  it('shows the brand and the rating when given, and keeps their rows otherwise', () => {
    const { container, rerender } = render(card({ brand: 'DEWALT', rating: 4.5 }));
    expect(screen.getByText('DEWALT').className).toContain('font-bold');
    expect(screen.getByRole('img', { name: 'Calificación: 4.5 de 5 estrellas' })).toBeTruthy();

    rerender(card({ brand: null, rating: null }));
    expect(container.querySelector('[data-slot="product-card-brand"]')?.textContent).toBe('');
    expect(container.querySelector('[data-slot="product-card-rating"]')?.className).toContain(
      'min-h-[24px]',
    );
    expect(screen.queryByRole('img', { name: /Calificación/ })).toBeNull();
  });

  it('renders the image box without an image when the product has none', () => {
    const { container } = render(card({ image: null }));

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot="product-card-image"]')).toBeTruthy();
  });

  it('uses the PWA recommendation slider card in the slider variant', () => {
    render(card({ variant: 'slider', rating: 4 }));

    const link = screen.getByRole('link');
    expect(link.className).toContain('rounded-[10px]');
    expect(link.className).toContain('hover:-translate-y-0.5');
    expect(link.className).toContain('motion-reduce:transition-none');
    const name = screen.getByRole('heading', { level: 3, name: 'Taladro inalámbrico' });
    expect(name.className).toContain('text-[12px]');
    expect(name.className).toContain('line-clamp-2');
    expect(screen.getByRole('img', { name: 'Calificación: 4.0 de 5 estrellas' })).toBeTruthy();
  });
});

describe('ProductGrid (PWA Gallery grid)', () => {
  it('is a list with 2 columns, 4 from 800px and the Gallery gaps', () => {
    render(
      <ProductGrid>
        <li>uno</li>
      </ProductGrid>,
    );

    const list = screen.getByRole('list');
    expect(list.dataset.slot).toBe('product-grid');
    for (const token of [
      'grid-cols-2',
      'gap-x-2',
      'gap-y-6',
      'min-[800px]:grid-cols-4',
      'min-[1280px]:gap-x-4',
      'min-[1280px]:gap-y-8',
      'leading-none',
    ]) {
      expect(list.className.split(' ')).toContain(token);
    }
  });
});
