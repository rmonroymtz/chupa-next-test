import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { CartGatewayError } from '@/modules/cart/application/ports';
import { createMagentoCartGateway } from '@/modules/cart/infrastructure/magento-cart-gateway';
import { mapCartDetails } from '@/modules/cart/infrastructure/magento-cart-mapper';
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
  items: [
    {
      uid: 'item-1',
      quantity: 2,
      is_from_quote: false,
      out_of_stock: false,
      product: {
        uid: 'p1',
        name: 'Audífonos',
        sku: 'B0TESTSKU1',
        url_key: 'amazon-B0TESTSKU1-audifonos',
        thumbnail: { url: 'https://chupaprecios.com.mx/media/thumb.jpg' },
        small_image: { url: 'https://chupaprecios.com.mx/media/small.jpg' },
        stock_status: 'IN_STOCK',
      },
      prices: {
        price: { currency: 'MXN', value: 649.25 },
        row_total: { value: 1298.5 },
      },
    },
    {
      uid: 'item-2',
      quantity: 1,
      is_from_quote: true,
      out_of_stock: true,
      product: {
        uid: 'p2',
        name: 'Playera',
        sku: 'PARENT-1',
        url_key: 'ebay-1-playera',
        thumbnail: { url: 'https://chupaprecios.com.mx/media/playera.jpg' },
        small_image: null,
        stock_status: 'IN_STOCK',
      },
      prices: { price: { currency: 'MXN', value: 250 }, row_total: { value: 250 } },
      configurable_options: [
        { option_label: 'Talla', value_label: 'M' },
        { option_label: 'Color', value_label: 'Rojo' },
      ],
    },
  ],
};

const DETAILS = {
  totalQuantity: 3,
  items: [
    {
      uid: 'item-1',
      name: 'Audífonos',
      sku: 'B0TESTSKU1',
      url: '/amazon-B0TESTSKU1-audifonos.html',
      imageUrl: 'https://chupaprecios.com.mx/media/small.jpg',
      quantity: 2,
      unitPrice: { amount: 649.25, currency: 'MXN' },
      options: [],
      outOfStock: false,
      isFromQuote: false,
    },
    {
      uid: 'item-2',
      name: 'Playera',
      sku: 'PARENT-1',
      url: '/ebay-1-playera.html',
      imageUrl: 'https://chupaprecios.com.mx/media/playera.jpg',
      quantity: 1,
      unitPrice: { amount: 250, currency: 'MXN' },
      options: [
        { label: 'Talla', value: 'M' },
        { label: 'Color', value: 'Rojo' },
      ],
      outOfStock: true,
      isFromQuote: true,
    },
  ],
};

describe('mapCartDetails', () => {
  it('maps items with the small image first, quote and stock flags, options and unit price', () => {
    expect(mapCartDetails(RAW_CART, '.html')).toEqual(DETAILS);
  });

  it('flags an item out of stock when only the product stock status says so', () => {
    const raw = {
      total_quantity: 1,
      items: [
        {
          uid: 'item-1',
          quantity: 1,
          out_of_stock: false,
          product: { name: 'Lámpara', sku: 'B0LAMP', stock_status: 'OUT_OF_STOCK' },
        },
      ],
    };
    expect(mapCartDetails(raw, '.html').items[0]?.outOfStock).toBe(true);
  });

  it('tolerates missing totals, prices and null items', () => {
    expect(mapCartDetails({ total_quantity: null, items: [null] }, '.html')).toEqual({
      totalQuantity: 0,
      items: [],
    });
    expect(mapCartDetails(null, '.html')).toEqual({ totalQuantity: 0, items: [] });
  });
});

describe('createMagentoCartGateway cart details', () => {
  it('reads the cart with the legacy GetCartDetails operation and the Bearer token', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { cart: RAW_CART } }, captured);
    const { gateway, logLines } = setup();

    await expect(gateway.getCartDetails('cart-1', { signinToken: TOKEN })).resolves.toEqual(
      DETAILS,
    );
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('GetCartDetails');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'cart-1' });
    expect(captured[0]?.body.query).toContain('is_from_quote');
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });

  it('updates a quantity with the legacy updateItemQuantity mutation and answers the cart', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { updateCartItems: { cart: RAW_CART } } }, captured);
    const { gateway } = setup();

    await expect(
      gateway.updateCartItemQuantity('cart-1', 'MTIz', 4, { signinToken: null }),
    ).resolves.toEqual(DETAILS);
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.body.operationName).toBe('updateItemQuantity');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'cart-1', itemId: 'MTIz', quantity: 4 });
    expect(captured[0]?.body.query).toContain('updateCartItems');
  });

  it('removes an item with the legacy removeItem mutation and answers the cart', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { removeItemFromCart: { cart: RAW_CART } } }, captured);
    const { gateway } = setup();

    await expect(
      gateway.removeCartDetailsItem('cart-1', 'MTIz', { signinToken: TOKEN }),
    ).resolves.toEqual(DETAILS);
    expect(captured[0]?.body.operationName).toBe('removeItem');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'cart-1', itemId: 'MTIz' });
  });

  it('maps a cart Magento rejects to invalid_cart and other errors to failure', async () => {
    respondWith({ errors: [{ message: 'Could not find a cart with ID "stale"' }], data: null }, []);
    const { gateway } = setup();
    const invalid = await gateway
      .getCartDetails('stale', { signinToken: null })
      .catch((caught: unknown) => caught);
    expect((invalid as CartGatewayError).kind).toBe('invalid_cart');

    respondWith({ errors: [{ message: 'The requested qty is not available' }], data: null }, []);
    const failed = await gateway
      .updateCartItemQuantity('cart-1', 'MTIz', 99, { signinToken: null })
      .catch((caught: unknown) => caught);
    expect((failed as CartGatewayError).kind).toBe('failure');
  });

  it.each([
    ['getCartDetails', { cart: null }],
    ['updateCartItemQuantity', { updateCartItems: null }],
    ['removeCartDetailsItem', { removeItemFromCart: null }],
  ] as const)('fails when %s answers no cart', async (method, data) => {
    respondWith({ data }, []);
    const { gateway } = setup();
    const auth = { signinToken: null };
    const call =
      method === 'getCartDetails'
        ? gateway.getCartDetails('cart-1', auth)
        : method === 'updateCartItemQuantity'
          ? gateway.updateCartItemQuantity('cart-1', 'MTIz', 2, auth)
          : gateway.removeCartDetailsItem('cart-1', 'MTIz', auth);
    const error = await call.catch((caught: unknown) => caught);
    expect((error as CartGatewayError).kind).toBe('failure');
  });
});
