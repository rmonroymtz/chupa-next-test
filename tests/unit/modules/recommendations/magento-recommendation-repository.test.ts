import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoRecommendationRepository } from '@/modules/recommendations/infrastructure/magento-recommendation-repository';
import { createMagentoClient, MagentoRequestError } from '@/shared/graphql/client';
import alsoBought from '../../../fixtures/magento/random-products.also-bought.json';
import recently from '../../../fixtures/magento/random-products.recently.json';
import tendency from '../../../fixtures/magento/random-products.tendency.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

function setup(timeoutMs = 500) {
  const observability = createCapturingObservability();
  const repository = createMagentoRecommendationRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 5_000,
      storeCode: 'default',
      currency: 'MXN',
      ...observability,
    }),
    { timeoutMs, currency: 'MXN' },
  );
  return { repository, observability };
}

function answer(payload: Record<string, unknown>) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(URL, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(payload);
    }),
  );
  return bodies;
}

const product = (overrides: Record<string, unknown> = {}) => ({
  sku: 'B000000001',
  image: 'https://m.media-amazon.com/images/I/1.jpg',
  name: 'Taladro',
  price: 100,
  regular_price: 0,
  review_stars: 4.5,
  store: 'amazon',
  link: 'amazon-B000000001-taladro.html',
  ...overrides,
});

const withProducts = (products: unknown) => ({ data: { randomProducts: { products } } });

describe('MagentoRecommendationRepository', () => {
  it('asks GetRandomProducts for the slider type and limit, without keywords or order', async () => {
    const bodies = answer(tendency);

    await setup().repository.findRandom('tendency', 30);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.operationName).toBe('GetRandomProducts');
    expect(bodies[0]?.variables).toEqual({ limit: 30, type: 'tendency' });
    expect(String(bodies[0]?.query)).toContain('randomProducts(limit: $limit, type: $type');
  });

  it.each([
    ['tendency', tendency],
    ['also_bought', alsoBought],
    ['recently', recently],
  ] as const)('maps every recorded staging %s product to a card', async (type, fixture) => {
    answer(fixture);

    const products = await setup().repository.findRandom(type, 30);

    expect(products).toHaveLength(fixture.data.randomProducts.products.length);
  });

  it('maps a recorded product: relative url from the link, image, rating and MXN price', async () => {
    answer(tendency);

    const [first] = await setup().repository.findRandom('tendency', 30);
    const recorded = tendency.data.randomProducts.products[0]!;

    expect(first).toEqual({
      uid: `amazon-${recorded.sku}`,
      sku: recorded.sku,
      name: recorded.name,
      urlKey: recorded.link.replace(/\.html$/, ''),
      relativeUrl: recorded.link,
      image: { url: recorded.image, label: null },
      price: {
        final: { amount: recorded.price, currency: 'MXN' },
        regular: { amount: recorded.price, currency: 'MXN' },
        discount: null,
      },
      availability: 'unknown',
      rating: recorded.review_stars,
    });
  });

  it('keeps the regular price only when it is higher than the price (staging sends 0 without a discount)', async () => {
    answer(tendency);

    const products = await setup().repository.findRandom('tendency', 30);
    const recorded = tendency.data.randomProducts.products;
    const discounted = recorded.filter((entry) => entry.regular_price > entry.price);

    expect(discounted.length).toBeGreaterThan(0);
    for (const entry of recorded) {
      const card = products.find((candidate) => candidate.sku === entry.sku);
      const regular = entry.regular_price > entry.price ? entry.regular_price : entry.price;
      expect(card?.price?.regular.amount).toBe(regular);
      expect(card?.price?.final.amount).toBe(entry.price);
    }
  });

  it('drops a leading slash from the link and no rating for 0 or a missing value', async () => {
    answer(
      withProducts([
        product({ link: '/amazon-B000000001-taladro.html', review_stars: 0 }),
        product({ sku: 'B000000002', link: 'amazon-B000000002-x.html', review_stars: null }),
      ]),
    );

    const products = await setup().repository.findRandom('recently', 30);

    expect(products.map((card) => [card.relativeUrl, card.rating])).toEqual([
      ['amazon-B000000001-taladro.html', null],
      ['amazon-B000000002-x.html', null],
    ]);
  });

  it('skips products without a sku, name, link or positive price, and repeated skus', async () => {
    answer(
      withProducts([
        null,
        product({ sku: '' }),
        product({ sku: 'B2', name: '  ' }),
        product({ sku: 'B3', link: null }),
        product({ sku: 'B4', price: 0 }),
        product({ sku: 'B5', price: 'cheap' }),
        product({ sku: 'B6', image: null }),
        product({ sku: 'B6' }),
      ]),
    );

    const products = await setup().repository.findRandom('tendency', 30);

    expect(products.map((card) => [card.sku, card.image])).toEqual([['B6', null]]);
  });

  it('answers no products when Magento sends no randomProducts', async () => {
    answer({ data: { randomProducts: null } });

    await expect(setup().repository.findRandom('tendency', 30)).resolves.toEqual([]);
  });

  it('rejects with the Magento error on an HTTP failure (the client logs and meters it)', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    const { repository, observability } = setup();

    await expect(repository.findRandom('tendency', 30)).rejects.toBeInstanceOf(MagentoRequestError);
    expect(observability.metricsNamed('MagentoError')[0]?.dimensions).toEqual({
      Operation: 'GetRandomProducts',
      Kind: 'http',
    });
  });

  it('rejects with a timeout after its own timeout, not the client default', async () => {
    server.use(
      http.post(URL, async () => {
        await delay(1_000);
        return HttpResponse.json(tendency);
      }),
    );

    await expect(setup(50).repository.findRandom('tendency', 30)).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});
