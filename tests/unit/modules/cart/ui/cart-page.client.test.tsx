// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartDetailsItem, CartSummary } from '@/modules/cart/application/ports';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import { CartPage } from '@/modules/cart/ui/cart-page.client';
import { cartCountStore } from '@/modules/cart/ui/cart-store';

const actions = vi.hoisted(() => ({
  getCartDetailsAction: vi.fn(),
  updateCartItemAction: vi.fn(),
  removeCartDetailsItemAction: vi.fn(),
}));
vi.mock('@/modules/cart/ui/cart-actions', () => actions);

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

const PLAYERA: CartDetailsItem = {
  uid: 'item-1',
  name: 'Playera',
  sku: 'PARENT-1',
  url: '/ebay-1-playera.html',
  imageUrl: 'https://chupaprecios.com.mx/media/a.jpg',
  quantity: 3,
  unitPrice: { amount: 516.17, currency: 'MXN' },
  options: [{ label: 'Talla', value: 'M' }],
  outOfStock: false,
  isFromQuote: false,
};

const LAMPARA: CartDetailsItem = {
  uid: 'item-2',
  name: 'Lámpara',
  sku: 'B0LAMP',
  url: '/amazon-B0LAMP-lampara.html',
  imageUrl: null,
  quantity: 1,
  unitPrice: { amount: 250, currency: 'MXN' },
  options: [],
  outOfStock: false,
  isFromQuote: false,
};

const mxn = (amount: number) => ({ amount, currency: 'MXN' });

const SUMMARY: CartSummary = {
  subtotal: mxn(1798.5),
  discounts: [],
  taxes: [],
  selectedShipping: null,
  shippingEstimate: null,
  grandTotal: mxn(1798.5),
  freeShippingThreshold: null,
};

const cartOf = (...items: CartDetailsItem[]) => cartWith({}, ...items);

const cartWith = (summary: Partial<CartSummary>, ...items: CartDetailsItem[]) => ({
  totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  items,
  summary: { ...SUMMARY, ...summary },
});

function storeCart(): void {
  window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
}

function storeToken(): void {
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
}

const row = (name: string) => screen.getByRole('listitem', { name });

beforeEach(() => {
  Object.values(actions).forEach((mock) => mock.mockReset());
  cartCountStore.reset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe('CartPage', () => {
  it('shows the empty state without reading Magento when the shopper has no cart', async () => {
    render(<CartPage />);

    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(
      screen.getByText(
        'Tenemos millones de productos, estamos seguros de que encontrarás lo que estás buscando',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continuar comprando →' }).getAttribute('href')).toBe(
      '/',
    );
    expect(actions.getCartDetailsAction).not.toHaveBeenCalled();
    expect(cartCountStore.get()).toBe(0);
  });

  it('reads the cart with the PWA cart id and token, then lists the items', async () => {
    storeCart();
    storeToken();
    actions.getCartDetailsAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf(PLAYERA, LAMPARA),
    });
    render(<CartPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi carrito' })).toBeTruthy();
    expect(actions.getCartDetailsAction).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: 'a.b.c',
    });
    const playera = within(row('Playera'));
    expect(playera.getByRole('link', { name: 'Playera' }).getAttribute('href')).toBe(
      '/ebay-1-playera.html',
    );
    expect(playera.getByText('Talla')).toBeTruthy();
    expect(playera.getByText('M')).toBeTruthy();
    expect((playera.getByLabelText('Cantidad de Playera') as HTMLInputElement).value).toBe('3');
    expect(within(row('Lámpara')).getByText(/250/)).toBeTruthy();
    expect(cartCountStore.get()).toBe(4);
  });

  it('puts quote items in their own section and changes the heading', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf(PLAYERA, { ...LAMPARA, isFromQuote: true }),
    });
    render(<CartPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mi carrito + cotización' }),
    ).toBeTruthy();
    const regular = screen.getByRole('region', { name: 'Productos en tu carrito' });
    const quotes = screen.getByRole('region', { name: 'Productos en tus cotizaciones' });
    expect(within(regular).getByText('Playera')).toBeTruthy();
    expect(within(regular).queryByText('Lámpara')).toBeNull();
    expect(within(quotes).getByText('Lámpara')).toBeTruthy();
  });

  it('shows the out-of-stock message when an item is out of stock', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf({ ...PLAYERA, outOfStock: true }),
    });
    render(<CartPage />);

    expect(
      await screen.findByText(
        'Un artículo en tu carrito está agotado actualmente y debe eliminarse para proceder al pago.',
      ),
    ).toBeTruthy();
  });

  it('shows the empty state for a cart Magento rejects', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'invalid_cart' });
    render(<CartPage />);

    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(cartCountStore.get()).toBe(0);
  });

  it('shows an error with a retry when the read fails', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValueOnce({ status: 'failed' });
    render(<CartPage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos cargar tu carrito');

    actions.getCartDetailsAction.mockResolvedValueOnce({ status: 'ok', cart: cartOf(PLAYERA) });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Playera')).toBeTruthy();
    expect(actions.getCartDetailsAction).toHaveBeenCalledTimes(2);
  });

  it('updates a quantity with the increment button and refreshes the row and the header count', async () => {
    storeCart();
    storeToken();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
    actions.updateCartItemAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf({ ...PLAYERA, quantity: 4 }),
    });
    render(<CartPage />);
    await screen.findByText('Playera');

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Playera' }));

    await waitFor(() =>
      expect((screen.getByLabelText('Cantidad de Playera') as HTMLInputElement).value).toBe('4'),
    );
    expect(actions.updateCartItemAction).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: 'a.b.c',
      itemUid: 'item-1',
      quantity: 4,
    });
    expect(cartCountStore.get()).toBe(4);
  });

  it('commits a typed quantity on Enter and ignores an invalid one', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
    actions.updateCartItemAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf({ ...PLAYERA, quantity: 7 }),
    });
    render(<CartPage />);
    await screen.findByText('Playera');
    const input = screen.getByLabelText('Cantidad de Playera') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.updateCartItemAction).not.toHaveBeenCalled();
    expect(input.value).toBe('3');

    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('7'));
    expect(actions.updateCartItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ itemUid: 'item-1', quantity: 7 }),
    );
  });

  it('does not decrement below 1: removing is its own button', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(LAMPARA) });
    render(<CartPage />);
    await screen.findByText('Lámpara');

    const decrement = screen.getByRole('button', { name: 'Disminuir cantidad de Lámpara' });
    expect(decrement.hasAttribute('disabled')).toBe(true);
  });

  it('keeps the quantity and tells the shopper when the update fails', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
    actions.updateCartItemAction.mockResolvedValue({ status: 'failed' });
    render(<CartPage />);
    await screen.findByText('Playera');

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Playera' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos actualizar tu carrito');
    expect((screen.getByLabelText('Cantidad de Playera') as HTMLInputElement).value).toBe('3');
    expect(cartCountStore.get()).toBe(3);
  });

  it('removes an item and shows the rest of the cart', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf(PLAYERA, LAMPARA),
    });
    actions.removeCartDetailsItemAction.mockResolvedValue({
      status: 'ok',
      cart: cartOf(LAMPARA),
    });
    render(<CartPage />);
    await screen.findByText('Playera');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Playera' }));

    await waitFor(() => expect(screen.queryByText('Playera')).toBeNull());
    expect(screen.getByText('Lámpara')).toBeTruthy();
    expect(actions.removeCartDetailsItemAction).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: null,
      itemUid: 'item-1',
    });
    expect(cartCountStore.get()).toBe(1);
  });

  it('shows the empty state after removing the last item', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(LAMPARA) });
    actions.removeCartDetailsItemAction.mockResolvedValue({
      status: 'ok',
      cart: { totalQuantity: 0, items: [] },
    });
    render(<CartPage />);
    await screen.findByText('Lámpara');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Lámpara' }));

    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(cartCountStore.get()).toBe(0);
  });

  it('tells the shopper when the removal fails and keeps the item', async () => {
    storeCart();
    actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(LAMPARA) });
    actions.removeCartDetailsItemAction.mockResolvedValue({ status: 'failed' });
    render(<CartPage />);
    await screen.findByText('Lámpara');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Lámpara' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos eliminar el artículo');
    expect(screen.getByText('Lámpara')).toBeTruthy();
  });

  describe('price summary', () => {
    const summary = () => screen.getByRole('complementary', { name: 'Resumen de compra' });

    it('shows the subtotal and the estimated total', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
      render(<CartPage />);
      await screen.findByText('Playera');

      expect(within(summary()).getByText('Subtotal')).toBeTruthy();
      expect(within(summary()).getByTestId('summary-subtotal').textContent).toMatch(/1,798\.50/);
      expect(within(summary()).getByText('Total estimado')).toBeTruthy();
      expect(within(summary()).getByTestId('summary-total').textContent).toMatch(/1,798\.50/);
      expect(within(summary()).queryByText('Envío')).toBeNull();
      expect(within(summary()).queryByText('Descuentos aplicados')).toBeNull();
    });

    it('adds the shipping estimate to the total and lists discounts and taxes', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({
        status: 'ok',
        cart: cartWith(
          {
            shippingEstimate: mxn(149),
            discounts: [{ label: 'Cupón', amount: mxn(98.5) }],
            taxes: [mxn(20), mxn(5)],
            grandTotal: mxn(1700),
          },
          PLAYERA,
        ),
      });
      render(<CartPage />);
      await screen.findByText('Playera');

      expect(within(summary()).getByTestId('summary-shipping').textContent).toMatch(/149\.00/);
      expect(within(summary()).getByTestId('summary-total').textContent).toMatch(/1,849\.00/);
      expect(within(summary()).getByTestId('summary-discounts').textContent).toMatch(/-.*98\.50/);
      expect(within(summary()).getByTestId('summary-taxes').textContent).toMatch(/25\.00/);
    });

    it('shows a zero shipping estimate as free', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({
        status: 'ok',
        cart: cartWith({ shippingEstimate: mxn(0) }, PLAYERA),
      });
      render(<CartPage />);
      await screen.findByText('Playera');

      expect(within(summary()).getByTestId('summary-shipping').textContent).toBe('Gratis');
    });

    it('shows the free shipping threshold when Magento has one', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({
        status: 'ok',
        cart: cartWith({ freeShippingThreshold: 999 }, PLAYERA),
      });
      render(<CartPage />);
      await screen.findByText('Playera');

      expect(
        within(summary()).getByText(/Tu envío es gratuito en compras mayores a/).textContent,
      ).toMatch(/999/);
    });

    it('links the checkout button to the PWA checkout', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
      render(<CartPage />);
      await screen.findByText('Playera');

      const checkout = within(summary()).getByRole('link', { name: 'Proceder al pago' });
      expect(checkout.getAttribute('href')).toBe('/checkout');
    });

    it('blocks the checkout button while the cart is updating, like the legacy isUpdating', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
      let finish: (value: unknown) => void = () => {};
      actions.updateCartItemAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      render(<CartPage />);
      await screen.findByText('Playera');

      fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Playera' }));

      const checkout = await within(summary()).findByRole('link', { name: 'Proceder al pago' });
      expect(checkout.getAttribute('aria-disabled')).toBe('true');
      expect(checkout.hasAttribute('href')).toBe(false);
      finish({ status: 'ok', cart: cartOf({ ...PLAYERA, quantity: 4 }) });
      await waitFor(() =>
        expect(
          within(summary()).getByRole('link', { name: 'Proceder al pago' }).getAttribute('href'),
        ).toBe('/checkout'),
      );
    });

    it('refreshes the summary with the response of a change', async () => {
      storeCart();
      actions.getCartDetailsAction.mockResolvedValue({ status: 'ok', cart: cartOf(PLAYERA) });
      actions.updateCartItemAction.mockResolvedValue({
        status: 'ok',
        cart: cartWith(
          { subtotal: mxn(2314.67), grandTotal: mxn(2314.67) },
          {
            ...PLAYERA,
            quantity: 4,
          },
        ),
      });
      render(<CartPage />);
      await screen.findByText('Playera');

      fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad de Playera' }));

      await waitFor(() =>
        expect(within(summary()).getByTestId('summary-subtotal').textContent).toMatch(/2,314\.67/),
      );
    });
  });
});
