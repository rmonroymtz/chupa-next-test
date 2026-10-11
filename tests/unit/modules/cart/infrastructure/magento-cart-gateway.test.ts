import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { CartGatewayError } from '@/modules/cart/application/ports';
import { createMagentoCartGateway } from '@/modules/cart/infrastructure/magento-cart-gateway';
import { mapMiniCart } from '@/modules/cart/infrastructure/magento-cart-mapper';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const TOKEN = 'secret.jwt.token';
const server = setupMswServer();

interface Captured {
  authorization: string | null;
  body: { operationName: string; query: string; variables: Record<string, unknown> };
}

function setup() {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs: 500,
    storeCode: 'default',
    currency: 'MXN',
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway: createMagentoCartGateway(client), ...observability };
}

function respondWith(payload: JsonBodyType, captured: Captured[]) {
  server.use(
    http.post(URL, async ({ request }) => {
      captured.push({
        authorization: request.headers.get('authorization'),
        body: (await request.json()) as Captured['body'],
      });
      return HttpResponse.json(payload);
    }),
  );
}

const RAW_CART = {
  id: 'cart-1',
  total_quantity: 3,
  prices: { subtotal_excluding_tax: { currency: 'MXN', value: 1548.5 } },
  items: [
    {
      uid: 'item-1',
      quantity: 2,
      product: {
        uid: 'p1',
        name: 'Audífonos',
        sku: 'B0TESTSKU1',
        url_key: 'amazon-B0TESTSKU1-audifonos',
        thumbnail: { url: 'https://chupaprecios.com.mx/media/a.jpg' },
        stock_status: 'IN_STOCK',
      },
      prices: { price: { currency: 'MXN', value: 649.25 } },
    },
    {
      uid: 'item-2',
      quantity: 1,
      product: {
        uid: 'p2',
        name: 'Playera',
        sku: 'PARENT-1',
        url_key: 'ebay-1-playera',
        thumbnail: null,
        stock_status: 'OUT_OF_STOCK',
      },
      prices: { price: { currency: 'MXN', value: 250 } },
      configurable_options: [
        { option_label: 'Talla', value_label: 'M' },
        { option_label: 'Color', value_label: 'Rojo' },
      ],
    },
  ],
};

describe('createMagentoCartGateway', () => {
  it('creates a guest cart with the legacy createCart mutation and no Authorization header', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { cartId: 'guest-cart' } }, captured);
    const { gateway } = setup();

    await expect(gateway.createEmptyCart({ signinToken: null })).resolves.toBe('guest-cart');
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.body.operationName).toBe('createCart');
    expect(captured[0]?.body.query).toContain('cartId: createEmptyCart');
  });

  it('sends the sign-in token as a Bearer token, like the PWA auth link', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { cartId: 'customer-cart' } }, captured);
    const { gateway, logLines } = setup();

    await gateway.createEmptyCart({ signinToken: TOKEN });
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });

  it('adds the product with the legacy AddProductToCart mutation and returns count and user errors', async () => {
    const captured: Captured[] = [];
    respondWith(
      {
        data: {
          addProductsToCart: {
            cart: { id: 'cart-1', total_quantity: 2 },
            user_errors: [{ code: 'NOT_SALABLE', message: 'Producto no disponible' }],
          },
        },
      },
      captured,
    );
    const { gateway } = setup();
    const item = { sku: 'PARENT-1', quantity: 2, vendor: 'ebay', selected_options: ['a', 'b'] };

    await expect(gateway.addProductToCart('cart-1', item, { signinToken: null })).resolves.toEqual({
      totalQuantity: 2,
      userErrors: [{ code: 'NOT_SALABLE', message: 'Producto no disponible' }],
    });
    expect(captured[0]?.body.operationName).toBe('AddProductToCart');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'cart-1', product: item });
  });

  it.each([
    'Could not find a cart with ID "stale"',
    "The cart isn't active.",
    'The current user cannot perform operations on cart "stale"',
  ])('maps "%s" to an invalid_cart error', async (message) => {
    respondWith({ errors: [{ message }], data: { addProductsToCart: null } }, []);
    const { gateway } = setup();

    const error = await gateway
      .addProductToCart('stale', { sku: 's', quantity: 1, vendor: 'amazon' }, { signinToken: null })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CartGatewayError);
    expect((error as CartGatewayError).kind).toBe('invalid_cart');
  });

  it('maps other Magento failures to a failure error', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    const { gateway } = setup();

    const error = await gateway
      .getCartCount('c', { signinToken: null })
      .catch((caught: unknown) => caught);
    expect((error as CartGatewayError).kind).toBe('failure');
  });

  it('reads the item count with the legacy getItemCount query', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { cart: { id: 'c', total_quantity: 7 } } }, captured);
    const { gateway } = setup();

    await expect(gateway.getCartCount('c', { signinToken: null })).resolves.toBe(7);
    expect(captured[0]?.body.operationName).toBe('getItemCount');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'c' });
  });

  it('reads the mini cart with the MiniCartQuery fields', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { cart: RAW_CART } }, captured);
    const { gateway } = setup();

    const cart = await gateway.getMiniCart('cart-1', { signinToken: TOKEN });
    expect(cart.totalQuantity).toBe(3);
    expect(captured[0]?.body.operationName).toBe('MiniCartQuery');
    expect(captured[0]?.body.query).toContain('subtotal_excluding_tax');
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
  });
});

describe('mapMiniCart', () => {
  it('maps items, variant details, unit prices and the excl. tax subtotal', () => {
    expect(mapMiniCart(RAW_CART, '.html')).toEqual({
      totalQuantity: 3,
      subtotal: { amount: 1548.5, currency: 'MXN' },
      items: [
        {
          uid: 'item-1',
          name: 'Audífonos',
          sku: 'B0TESTSKU1',
          url: '/amazon-B0TESTSKU1-audifonos.html',
          thumbnailUrl: 'https://chupaprecios.com.mx/media/a.jpg',
          quantity: 2,
          unitPrice: { amount: 649.25, currency: 'MXN' },
          options: [],
          outOfStock: false,
        },
        {
          uid: 'item-2',
          name: 'Playera',
          sku: 'PARENT-1',
          url: '/ebay-1-playera.html',
          thumbnailUrl: null,
          quantity: 1,
          unitPrice: { amount: 250, currency: 'MXN' },
          options: [
            { label: 'Talla', value: 'M' },
            { label: 'Color', value: 'Rojo' },
          ],
          outOfStock: true,
        },
      ],
    });
  });

  it('tolerates missing totals, prices and null items', () => {
    expect(mapMiniCart({ total_quantity: null, prices: null, items: [null] }, '.html')).toEqual({
      totalQuantity: 0,
      subtotal: null,
      items: [],
    });
    expect(mapMiniCart(null, '.html')).toEqual({ totalQuantity: 0, subtotal: null, items: [] });
  });
});
