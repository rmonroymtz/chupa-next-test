// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RecommendationType,
  RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';
import {
  RecommendationSliders,
  type RecommendationsLoader,
} from '@/modules/recommendations/ui/recommendation-sliders';

const card = (sku: string, overrides: Partial<RecommendedProduct> = {}): RecommendedProduct => ({
  uid: `amazon-${sku}`,
  sku,
  name: `Producto ${sku}`,
  urlKey: `amazon-${sku}-producto`,
  relativeUrl: `amazon-${sku}-producto.html`,
  image: { url: `https://m.media-amazon.com/images/I/${sku}.jpg`, label: null },
  price: {
    final: { amount: 100, currency: 'MXN' },
    regular: { amount: 100, currency: 'MXN' },
    discount: null,
  },
  availability: 'unknown',
  rating: null,
  ...overrides,
});

const loaderOf =
  (
    byType: Partial<Record<RecommendationType, readonly RecommendedProduct[]>>,
  ): RecommendationsLoader =>
  (type) =>
    Promise.resolve(byType[type] ?? []);

afterEach(() => {
  document.body.innerHTML = '';
});

async function renderAll(load: RecommendationsLoader) {
  const { prelude } = await prerender(<RecommendationSliders load={load} />);
  document.body.innerHTML = await new Response(prelude).text();
  return document.body;
}

const sliders = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-recommendation]')].map((slider) => ({
    type: slider.dataset.recommendation,
    title: slider.querySelector('h2')?.textContent,
    accent: slider.querySelector('h2 span')?.textContent,
    links: [...slider.querySelectorAll('a')].map((a) => a.getAttribute('href')),
  }));

describe('RecommendationSliders', () => {
  it('renders the three legacy sliders in order with their titles and product links', async () => {
    const load = vi.fn(
      loaderOf({
        tendency: [card('B1'), card('B2')],
        also_bought: [card('B3')],
        recently: [card('B4')],
      }),
    );

    const body = await renderAll(load);

    expect(sliders(body)).toEqual([
      {
        type: 'tendency',
        title: 'Los productos en tendencia',
        accent: 'tendencia',
        links: ['/amazon-B1-producto.html', '/amazon-B2-producto.html'],
      },
      {
        type: 'also_bought',
        title: 'Otras personas también compraron',
        accent: 'también compraron',
        links: ['/amazon-B3-producto.html'],
      },
      {
        type: 'recently',
        title: 'Productos más buscados recientemente',
        accent: 'recientemente',
        links: ['/amazon-B4-producto.html'],
      },
    ]);
    expect(load.mock.calls.map(([type]) => type)).toEqual(['tendency', 'also_bought', 'recently']);
  });

  it('starts the three loads in the same render (parallel), before any of them resolves', () => {
    const load = vi.fn(() => new Promise<readonly RecommendedProduct[]>(() => {}));

    renderToStaticMarkup(<RecommendationSliders load={load} />);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it('shows the title and skeleton cards while a slider loads (no links yet)', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <RecommendationSliders load={() => new Promise(() => {})} />,
    );

    const loading = [...document.querySelectorAll('[data-recommendation-loading]')];
    expect(loading).toHaveLength(3);
    expect(loading[0]?.querySelector('h2')?.textContent).toBe('Los productos en tendencia');
    expect(loading[0]?.querySelectorAll('[data-recommendation-skeleton]')).toHaveLength(5);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('lays the skeleton out as the PWA slider: 5 slides in the carousel, 2 / 3 from 640px / 5 from 1024px, 10px gap', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <RecommendationSliders load={() => new Promise(() => {})} />,
    );

    const loading = document.querySelector('[data-recommendation-loading]');
    const skeletons = [
      ...(loading?.querySelectorAll<HTMLElement>('[data-recommendation-skeleton]') ?? []),
    ];
    expect(skeletons).toHaveLength(5);
    const track = skeletons[0]?.parentElement;
    expect(track?.parentElement?.dataset.carouselViewport).toBeDefined();
    expect(track?.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'gap-[10px]']));
    expect(skeletons[0]?.className.split(' ')).toEqual(
      expect.arrayContaining([
        'basis-[calc(50%-5px)]',
        'min-[640px]:basis-[calc(33.33%-7px)]',
        'min-[1024px]:basis-[calc(20%-8px)]',
        'shrink-0',
        'min-w-0',
      ]),
    );
    expect(loading?.querySelectorAll('button[disabled]')).toHaveLength(2);
  });

  it('renders each slider as the PWA embla carousel: server-rendered cards in the viewport, arrows', async () => {
    const body = await renderAll(loaderOf({ tendency: [card('B1'), card('B2')] }));

    const slider = body.querySelector('[data-recommendation="tendency"]');
    const viewport = slider?.querySelector<HTMLElement>('[data-carousel-viewport]');
    expect(viewport?.className.split(' ')).toContain('overflow-hidden');
    expect(viewport?.querySelectorAll(':scope > ul > li')).toHaveLength(2);
    expect(
      [...(slider?.querySelectorAll('button') ?? [])].map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Producto anterior', 'Siguiente producto']);
  });

  it('hides a slider with no products or whose load rejects or throws, keeping the others', async () => {
    const load: RecommendationsLoader = (type) => {
      if (type === 'tendency') return Promise.reject(new Error('down'));
      if (type === 'also_bought') throw new Error('sync failure');
      return Promise.resolve([card('B9')]);
    };

    const body = await renderAll(load);

    expect(sliders(body).map((slider) => slider.type)).toEqual(['recently']);
  });

  it('renders nothing visible when every slider is empty', async () => {
    const body = await renderAll(loaderOf({}));

    expect(sliders(body)).toEqual([]);
    expect(body.querySelector('h2')).toBeNull();
  });

  it('cards: carousel, image, stars for a rating, price and the struck regular price', async () => {
    const body = await renderAll(
      loaderOf({
        tendency: [
          card('B1', {
            rating: 4.4,
            price: {
              final: { amount: 899, currency: 'MXN' },
              regular: { amount: 1299, currency: 'MXN' },
              discount: null,
            },
          }),
          card('B2'),
        ],
      }),
    );

    const [first, second] = [...body.querySelectorAll('[data-recommendation="tendency"] li')];
    expect(first?.querySelector('img')?.getAttribute('alt')).toBe('Producto B1');
    expect(first?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Calificación: 4.4 de 5 estrellas',
    );
    expect(first?.querySelector('s, del')?.textContent).toContain('1,299');
    expect(first?.textContent).toContain('899');
    expect(second?.querySelector('[role="img"]')).toBeNull();
    expect(second?.querySelector('s, del')).toBeNull();
  });
});
