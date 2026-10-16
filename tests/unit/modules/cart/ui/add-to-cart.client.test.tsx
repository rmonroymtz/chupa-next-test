// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  purchasableFromMagento,
  purchasableFromScraped,
  type PurchasableProduct,
} from '@/modules/cart/domain/add-to-cart';
import { AnalyticsProvider } from '@/modules/analytics/ui/analytics-provider.client';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import { AddToCart } from '@/modules/cart/ui/add-to-cart.client';
import { cartCountStore } from '@/modules/cart/ui/cart-store';
import type { ScrapedProduct } from '@/modules/product/domain/product';
import { buildMagentoProduct } from '../../../../support/magento-product';

const addToCartAction = vi.hoisted(() => vi.fn());
vi.mock('@/modules/cart/ui/cart-actions', () => ({
  addToCartAction,
  getCartCountAction: vi.fn(),
  getMiniCartAction: vi.fn(),
}));

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

const scrapedProduct: ScrapedProduct = {
  sku: 'B0ASIN0001',
  parentSku: null,
  vendor: 'amazon',
  title: 'Lámpara',
  brand: null,
  descriptionHtml: '',
  shortDescription: '',
  images: [],
  price: { current: 450, currency: 'MXN', before: null },
  stock: 3,
  availability: 'in_stock',
  itemAvailable: true,
  hasVariants: false,
  deliveryTo: true,
  condition: null,
  breadcrumbs: [],
  categories: [],
};

function renderAddToCart(product: PurchasableProduct) {
  return render(
    <AnalyticsProvider>
      <AddToCart product={product} />
    </AnalyticsProvider>,
  );
}

const button = () => screen.getByRole('button', { name: /agregar al carrito|agregando/i });

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/amazon-B0ASIN0001-lampara.html');
  cartCountStore.reset();
  addToCartAction.mockReset();
  (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AddToCart', () => {
  it('creates the cart on first add, stores it in the PWA format and updates the count', async () => {
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: 'created-cart',
      totalQuantity: 1,
      userErrors: [],
    });
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));

    expect(addToCartAction).toHaveBeenCalledWith({
      cartId: null,
      signinToken: null,
      item: { sku: 'B0ASIN0001', quantity: 1, vendor: 'amazon' },
    });
    const stored = JSON.parse(window.localStorage.getItem(CART_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(stored)).toEqual(['value', 'timeStored']);
    expect(stored.value).toBe('"created-cart"');
    expect(cartCountStore.get()).toBe(1);
    expect(screen.getByRole('status')).toHaveProperty(
      'textContent',
      '¡Producto agregado correctamente!',
    );
    // Same GA4 payload the cart pushed before the analytics module.
    expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toEqual([
      {
        event: 'add_to_cart',
        ecommerce: {
          currency: 'MXN',
          value: 450,
          items: [{ item_id: 'B0ASIN0001', item_name: 'Lámpara', price: 450, quantity: 1 }],
        },
      },
    ]);
  });

  it('sends the stored PWA cart id and an unexpired token, and never writes the token', async () => {
    const token = encodePersisted('jwt.value', Date.now() - 1000, 3600);
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    window.localStorage.setItem(TOKEN_KEY, token);
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: null,
      totalQuantity: 4,
      userErrors: [],
    });
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));

    expect(addToCartAction).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: 'pwa-cart', signinToken: 'jwt.value' }),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(cartCountStore.get()).toBe(4);
  });

  it('caps the quantity at the scraper stock', async () => {
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: null,
      totalQuantity: 3,
      userErrors: [],
    });
    renderAddToCart(purchasableFromScraped(scrapedProduct));
    const increase = screen.getByRole('button', { name: 'Aumentar cantidad' });

    for (let i = 0; i < 5; i += 1) fireEvent.click(increase);
    expect(screen.getByRole('spinbutton', { name: 'Cantidad de artículos' })).toHaveProperty(
      'value',
      '3',
    );
    expect(increase).toHaveProperty('disabled', true);

    await act(async () => fireEvent.click(button()));
    expect(addToCartAction).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ quantity: 3 }) }),
    );
  });

  it('shows Magento user errors and does not report success', async () => {
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: null,
      totalQuantity: 0,
      userErrors: [{ code: 'NOT_SALABLE', message: 'El producto no está disponible.' }],
    });
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));

    expect(screen.getByRole('alert').textContent).toBe('El producto no está disponible.');
    expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toEqual([]);
  });

  it('shows the legacy failure message and still stores a cart created before the failure', async () => {
    addToCartAction.mockResolvedValue({ status: 'failed', newCartId: 'orphan-cart' });
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));

    expect(screen.getByRole('alert').textContent).toBe(
      'Lo sentimos, no pudimos agregar este producto al carrito.',
    );
    expect(window.localStorage.getItem(CART_KEY)).toContain('orphan-cart');
  });

  it('shows the failure message when the action itself rejects', async () => {
    addToCartAction.mockRejectedValue(new Error('network'));
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));

    expect(screen.getByRole('alert').textContent).toBe(
      'Lo sentimos, no pudimos agregar este producto al carrito.',
    );
    expect(button()).toHaveProperty('disabled', false);
  });

  it('disables the button for a Magento product out of stock', () => {
    renderAddToCart(purchasableFromMagento(buildMagentoProduct({ availability: 'out_of_stock' })));
    expect(button()).toHaveProperty('disabled', true);
  });

  it('requires configurable options and sends their uids', async () => {
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: null,
      totalQuantity: 1,
      userErrors: [],
    });
    const product = purchasableFromMagento(
      buildMagentoProduct({
        typename: 'ConfigurableProduct',
        sku: 'PARENT-1',
        configurableOptions: [
          {
            uid: 'opt-size',
            attributeCode: 'size',
            label: 'Talla',
            values: [
              { uid: 'size-s', label: 'S', valueIndex: 1 },
              { uid: 'size-m', label: 'M', valueIndex: 2 },
            ],
          },
        ],
        variants: [
          {
            uid: 'v1',
            sku: 'CHILD-S',
            name: null,
            availability: 'in_stock',
            price: null,
            attributes: [{ code: 'size', label: 'S', valueIndex: 1 }],
          },
          {
            uid: 'v2',
            sku: 'CHILD-M',
            name: null,
            availability: 'out_of_stock',
            price: null,
            attributes: [{ code: 'size', label: 'M', valueIndex: 2 }],
          },
        ],
      }),
    );
    renderAddToCart(product);
    expect(button()).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: 'M' }));
    expect(button()).toHaveProperty('disabled', true);
    expect(screen.getByText('Este artículo está agotado actualmente')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'S' }));
    expect(button()).toHaveProperty('disabled', false);
    await act(async () => fireEvent.click(button()));
    expect(addToCartAction).toHaveBeenCalledWith(
      expect.objectContaining({
        item: { sku: 'PARENT-1', quantity: 1, vendor: 'amazon', selected_options: ['size-s'] },
      }),
    );
  });

  it('clears the success message after 3 seconds, like legacy', async () => {
    vi.useFakeTimers();
    addToCartAction.mockResolvedValue({
      status: 'added',
      newCartId: null,
      totalQuantity: 1,
      userErrors: [],
    });
    renderAddToCart(purchasableFromScraped(scrapedProduct));

    await act(async () => fireEvent.click(button()));
    expect(screen.getByRole('status').textContent).toBe('¡Producto agregado correctamente!');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
