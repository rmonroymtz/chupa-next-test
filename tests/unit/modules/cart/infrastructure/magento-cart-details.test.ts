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

function setup(options?: { priceChangeNotices?: boolean }) {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs: 500,
    storeCode: 'default',
    currency: 'MXN',
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway: createMagentoCartGateway(client, options), ...observability };
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
      cp_price_change: {
        changed: true,
        previous_price: 600,
        current_price: 649.25,
        delta: 49.25,
        out_of_stock: false,
      },
    },
    {
      uid: 'item-2',
      quantity: 1,
      is_from_quote: true,
      quote_expiration_date: '2026-11-20 23:59:59',
      is_quote_price_expired: true,
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

const NO_SUMMARY = {
  subtotal: null,
  discounts: [],
  taxes: [],
  selectedShipping: null,
  shippingEstimate: null,
  grandTotal: null,
  freeShippingThreshold: null,
};

const RAW_PRICES = {
  subtotal_excluding_tax: { currency: 'MXN', value: 1548.5 },
  grand_total: { currency: 'MXN', value: 1500 },
  discounts: [{ amount: { currency: 'MXN', value: 48.5 }, label: 'Cupón BIENVENIDA' }, null],
  applied_taxes: [{ amount: { currency: 'MXN', value: 12 } }],
};

const SUMMARY = {
  subtotal: { amount: 1548.5, currency: 'MXN' },
  discounts: [{ label: 'Cupón BIENVENIDA', amount: { amount: 48.5, currency: 'MXN' } }],
  taxes: [{ amount: 12, currency: 'MXN' }],
  selectedShipping: { amount: 99, currency: 'MXN' },
  shippingEstimate: null,
  grandTotal: { amount: 1500, currency: 'MXN' },
  freeShippingThreshold: null,
};

const DETAILS = {
  summary: NO_SUMMARY,
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
      rowTotal: { amount: 1298.5, currency: 'MXN' },
      quoteExpiresAt: null,
      quotePriceExpired: false,
      priceChange: {
        changed: true,
        previousPrice: 600,
        currentPrice: 649.25,
        delta: 49.25,
        outOfStock: false,
      },
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
      rowTotal: { amount: 250, currency: 'MXN' },
      quoteExpiresAt: '2026-11-20 23:59:59',
      quotePriceExpired: true,
      priceChange: null,
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

  it('has no row total, quote date or price change when Magento sends none', () => {
    const raw = {
      total_quantity: 1,
      items: [{ uid: 'i', quantity: 1, product: { name: 'x', sku: 'x' } }],
    };
    expect(mapCartDetails(raw, '.html').items[0]).toMatchObject({
      rowTotal: null,
      quoteExpiresAt: null,
      quotePriceExpired: false,
      priceChange: null,
    });
  });

  it('maps the price summary: subtotal, discounts, taxes, selected shipping and grand total', () => {
    const raw = {
      ...RAW_CART,
      prices: RAW_PRICES,
      shipping_addresses: [
        { selected_shipping_method: { amount: { currency: 'MXN', value: 99 } } },
      ],
    };
    expect(mapCartDetails(raw, '.html').summary).toEqual(SUMMARY);
  });

  it('has no selected shipping without an address or a chosen method', () => {
    const noAddress = { ...RAW_CART, prices: RAW_PRICES, shipping_addresses: [] };
    expect(mapCartDetails(noAddress, '.html').summary.selectedShipping).toBeNull();
    const noMethod = {
      ...RAW_CART,
      prices: RAW_PRICES,
      shipping_addresses: [{ selected_shipping_method: null }],
    };
    expect(mapCartDetails(noMethod, '.html').summary.selectedShipping).toBeNull();
  });

  it('tolerates missing totals, prices and null items', () => {
    expect(mapCartDetails({ total_quantity: null, items: [null] }, '.html')).toEqual({
      totalQuantity: 0,
      items: [],
      summary: NO_SUMMARY,
    });
    expect(mapCartDetails(null, '.html')).toEqual({
      totalQuantity: 0,
      items: [],
      summary: NO_SUMMARY,
    });
  });
});

describe('createMagentoCartGateway cart details', () => {
  it('asks for cp_price_change only when the refresh backend switch is on', async () => {
    const off: Captured[] = [];
    respondWith({ data: { cart: RAW_CART } }, off);
    await setup().gateway.getCartDetails('cart-1', { signinToken: null });
    expect(off[0]?.body.query).not.toContain('cp_price_change');
    expect(off[0]?.body.query).toContain('quote_expiration_date');
    expect(off[0]?.body.query).toContain('is_quote_price_expired');

    const on: Captured[] = [];
    respondWith({ data: { cart: RAW_CART } }, on);
    await setup({ priceChangeNotices: true }).gateway.getCartDetails('cart-1', {
      signinToken: null,
    });
    expect(on[0]?.body.query).toContain('cp_price_change');
  });

  it('refreshes expired quote prices with the legacy mutation and maps the renewed items', async () => {
    const captured: Captured[] = [];
    respondWith(
      {
        data: {
          refreshExpiredQuoteCartItemPrices: {
            items_renewed: [
              {
                cart_item_uid: 'MTIz',
                product_sku: 'B0LAMP',
                product_name: 'Lámpara',
                previous_price: 250,
                new_price: 300,
                quote_request_id: 7,
              },
              null,
            ],
            quotes_renewed: 1,
          },
        },
      },
      captured,
    );
    const { gateway } = setup();

    await expect(
      gateway.refreshExpiredQuotePrices('cart-1', { signinToken: TOKEN }),
    ).resolves.toEqual([
      { itemUid: 'MTIz', sku: 'B0LAMP', name: 'Lámpara', previousPrice: 250, newPrice: 300 },
    ]);
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('RefreshExpiredQuoteCartItemPrices');
    expect(captured[0]?.body.variables).toEqual({ cart_id: 'cart-1' });
  });

  it('fails when the refresh answers nothing', async () => {
    respondWith({ data: { refreshExpiredQuoteCartItemPrices: null } }, []);
    const error = await setup()
      .gateway.refreshExpiredQuotePrices('cart-1', { signinToken: null })
      .catch((caught: unknown) => caught);
    expect((error as CartGatewayError).kind).toBe('failure');
  });

  it('acknowledges the price changes with the legacy mutation', async () => {
    const captured: Captured[] = [];
    respondWith({ data: { acknowledgeCartPriceChanges: true } }, captured);

    await expect(
      setup().gateway.acknowledgeCartPriceChanges('cart-1', { signinToken: TOKEN }),
    ).resolves.toBeUndefined();
    expect(captured[0]?.body.operationName).toBe('AcknowledgeCartPriceChanges');
    expect(captured[0]?.body.variables).toEqual({ cartId: 'cart-1' });
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('maps an acknowledge Magento rejects to invalid_cart', async () => {
    respondWith({ errors: [{ message: 'Could not find a cart with ID "x"' }], data: null }, []);
    const error = await setup()
      .gateway.acknowledgeCartPriceChanges('x', { signinToken: null })
      .catch((caught: unknown) => caught);
    expect((error as CartGatewayError).kind).toBe('invalid_cart');
  });

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

  it('reads the shipping estimate and the free shipping threshold in one GetCartSummaryExtras call', async () => {
    const captured: Captured[] = [];
    respondWith(
      {
        data: {
          cart: { prices: { chupaprecios_shipping_estimate: { currency: 'MXN', value: 149 } } },
          storeConfig: { free_shipping_subtotal: '999' },
        },
      },
      captured,
    );
    const { gateway } = setup();

    await expect(gateway.getCartExtras('cart-1', { signinToken: TOKEN })).resolves.toEqual({
      shippingEstimate: { amount: 149, currency: 'MXN' },
      freeShippingThreshold: 999,
    });
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('GetCartSummaryExtras');
    expect(captured[0]?.body.query).toContain('chupaprecios_shipping_estimate');
    expect(captured[0]?.body.query).toContain('free_shipping_subtotal');
  });

  it('answers no estimate and no threshold when Magento has none', async () => {
    respondWith(
      { data: { cart: { prices: null }, storeConfig: { free_shipping_subtotal: null } } },
      [],
    );
    const { gateway } = setup();
    await expect(gateway.getCartExtras('cart-1', { signinToken: null })).resolves.toEqual({
      shippingEstimate: null,
      freeShippingThreshold: null,
    });
    respondWith({ data: { cart: null, storeConfig: { free_shipping_subtotal: 'abc' } } }, []);
    await expect(gateway.getCartExtras('cart-1', { signinToken: null })).resolves.toEqual({
      shippingEstimate: null,
      freeShippingThreshold: null,
    });
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
