// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import { cartCountStore } from '@/modules/cart/ui/cart-store';
import { MiniCart } from '@/modules/cart/ui/mini-cart.client';

const actions = vi.hoisted(() => ({
  addToCartAction: vi.fn(),
  getCartCountAction: vi.fn(),
  getMiniCartAction: vi.fn(),
}));
vi.mock('@/modules/cart/ui/cart-actions', () => actions);

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';

const CART = {
  totalQuantity: 3,
  subtotal: { amount: 1548.5, currency: 'MXN' },
  items: [
    {
      uid: 'item-1',
      name: 'Playera',
      sku: 'PARENT-1',
      url: '/ebay-1-playera.html',
      thumbnailUrl: 'https://chupaprecios.com.mx/media/a.jpg',
      quantity: 3,
      unitPrice: { amount: 516.17, currency: 'MXN' },
      options: [{ label: 'Talla', value: 'M' }],
      outOfStock: false,
    },
  ],
};

const trigger = () => screen.getByRole('button', { name: /mini carrito/i });

beforeEach(() => {
  window.localStorage.clear();
  cartCountStore.reset();
  Object.values(actions).forEach((mock) => mock.mockReset());
});

afterEach(cleanup);

describe('MiniCart', () => {
  it('shows no count and asks Magento nothing when there is no cart', async () => {
    await act(async () => render(<MiniCart />));
    expect(actions.getCartCountAction).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-label')).toBe(
      'Alternar mini carrito. Tienes 0 artículos en tu carrito.',
    );
    expect(screen.queryByTestId('cart-count')).toBeNull();
  });

  it('loads the count of the PWA cart on mount', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 120 });

    await act(async () => render(<MiniCart />));

    expect(actions.getCartCountAction).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: null,
    });
    expect(screen.getByTestId('cart-count').textContent).toBe('99+');
  });

  it('never lets a late initial count overwrite a newer count from add to cart', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    let resolveCount: (value: unknown) => void = () => {};
    actions.getCartCountAction.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );
    await act(async () => render(<MiniCart />));

    act(() => cartCountStore.set(5));
    await act(async () => resolveCount({ status: 'ok', totalQuantity: 4 }));

    expect(screen.getByTestId('cart-count').textContent).toBe('5');
  });

  it('never lets a late invalid-cart read reset a newer count to zero', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    let resolveCount: (value: unknown) => void = () => {};
    actions.getCartCountAction.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );
    await act(async () => render(<MiniCart />));

    act(() => cartCountStore.set(1));
    await act(async () => resolveCount({ status: 'invalid_cart' }));

    expect(screen.getByTestId('cart-count').textContent).toBe('1');
  });

  it('updates and announces the count when an item is added', async () => {
    await act(async () => render(<MiniCart />));
    act(() => cartCountStore.set(2));
    expect(screen.getByTestId('cart-count').textContent).toBe('2');
    expect(screen.getByTestId('cart-count-announcer').textContent).toBe(
      '2 artículos en tu carrito',
    );
  });

  it('is the DS "Carrito (N)" action: cart icon, label and count, same name and popup', async () => {
    await act(async () => render(<MiniCart />));
    act(() => cartCountStore.set(2));

    const button = trigger();
    expect(button.getAttribute('aria-label')).toBe(
      'Alternar mini carrito. Tienes 2 artículos en tu carrito.',
    );
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.dataset.slot).toBe('cart-trigger');
    // DS shopping-cart glyph (decorative) instead of the legacy cart image.
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // Visible "Carrito" label followed by the count, shown as "(2)" from 1024 (CSS parens).
    expect(within(button).getByText('Carrito')).toBeTruthy();
    const count = within(button).getByTestId('cart-count');
    expect(count.textContent).toBe('2');
    expect(count.className).toContain("lg:before:content-['(']");
    expect(count.className).toContain("lg:after:content-[')']");
  });

  it('opens the DS panel: head with title and "Editar carrito", items, subtotal and "Ir a pagar"', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 3 });
    actions.getMiniCartAction.mockResolvedValue({ status: 'ok', cart: CART });
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));

    const dialog = screen.getByRole('dialog', { name: 'Carrito (3 artículos)' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const view = within(dialog);
    // Head: the title (dialog name) and the PWA "Editar carrito" link to the PWA cart.
    expect(view.getByRole('heading', { level: 2, name: 'Carrito (3 artículos)' })).toBeTruthy();
    const edit = view.getByRole('link', { name: 'Editar carrito' });
    expect(edit.getAttribute('href')).toBe('/cart');
    expect(edit.closest('[data-slot="mini-cart-head"]')).toBeTruthy();
    // Item rows.
    const items = view.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const row = within(items[0]!);
    expect(row.getByRole('link', { name: 'Playera' }).getAttribute('href')).toBe(
      '/ebay-1-playera.html',
    );
    expect(row.getByText('Talla: M')).toBeTruthy();
    expect(row.getByText('Cantidad: 3')).toBeTruthy();
    expect(row.getByText(/516\.17/)).toBeTruthy();
    // Footer: subtotal and the main CTA to checkout (the PWA set: no "Ver carrito").
    const footer = dialog.querySelector<HTMLElement>('[data-slot="mini-cart-footer"]')!;
    expect(within(footer).getByText('Subtotal (3 art.):')).toBeTruthy();
    expect(within(footer).getByText(/1,548\.50/)).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Ir a pagar' }).getAttribute('href')).toBe(
      '/checkout',
    );
    expect(view.queryByRole('link', { name: 'Ver carrito' })).toBeNull();
    expect(view.queryByRole('link', { name: 'Finalizar compra' })).toBeNull();

    fireEvent.click(view.getByRole('button', { name: 'Cerrar carrito' }));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('marks an out-of-stock item and uses the singular title for one article', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 1 });
    actions.getMiniCartAction.mockResolvedValue({
      status: 'ok',
      cart: {
        ...CART,
        totalQuantity: 1,
        items: [{ ...CART.items[0]!, quantity: 1, outOfStock: true }],
      },
    });
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));

    const dialog = screen.getByRole('dialog', { name: 'Carrito (1 artículo)' });
    expect(within(dialog).getByText('Agotado')).toBeTruthy();
    expect(within(dialog).getByText('Subtotal (1 art.):')).toBeTruthy();
  });

  it('Escape closes the panel and marks the key handled for other listeners', async () => {
    await act(async () => render(<MiniCart />));
    await act(async () => fireEvent.click(trigger()));
    const dialog = screen.getByRole('dialog', { name: 'Carrito' });

    const notPrevented = fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(notPrevented).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the title and close button but no "Editar carrito" while loading', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 3 });
    actions.getMiniCartAction.mockReturnValue(new Promise(() => {}));
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));

    const dialog = screen.getByRole('dialog', { name: 'Carrito' });
    expect(within(dialog).getByRole('status').textContent).toBe('Cargando tu carrito...');
    expect(within(dialog).getByRole('button', { name: 'Cerrar carrito' })).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: 'Editar carrito' })).toBeNull();
  });

  it('shows the legacy empty message without a cart', async () => {
    await act(async () => render(<MiniCart />));
    await act(async () => fireEvent.click(trigger()));
    const dialog = screen.getByRole('dialog', { name: 'Carrito' });
    expect(within(dialog).getByText('No hay artículos en tu carrito.')).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: 'Ir a pagar' })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: 'Editar carrito' })).toBeNull();
    expect(actions.getMiniCartAction).not.toHaveBeenCalled();
  });

  it('offers a retry when the cart cannot be loaded', async () => {
    window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
    actions.getCartCountAction.mockResolvedValue({ status: 'failed' });
    actions.getMiniCartAction.mockResolvedValueOnce({ status: 'failed' });
    actions.getMiniCartAction.mockResolvedValueOnce({ status: 'ok', cart: CART });
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));
    expect(screen.getByText('No pudimos cargar tu carrito.')).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })));
    expect(screen.getByRole('link', { name: 'Playera' })).toBeTruthy();
  });

  it('treats a cart Magento rejects as empty without touching storage', async () => {
    const stored = encodePersisted('stale', Date.now());
    window.localStorage.setItem(CART_KEY, stored);
    actions.getCartCountAction.mockResolvedValue({ status: 'invalid_cart' });
    actions.getMiniCartAction.mockResolvedValue({ status: 'invalid_cart' });
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));

    expect(screen.getByText('No hay artículos en tu carrito.')).toBeTruthy();
    expect(window.localStorage.getItem(CART_KEY)).toBe(stored);
  });
});
