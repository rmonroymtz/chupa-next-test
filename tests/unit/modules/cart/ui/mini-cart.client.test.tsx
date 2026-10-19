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
  removeCartItemAction: vi.fn(),
}));
vi.mock('@/modules/cart/ui/cart-actions', () => actions);

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';

const PLAYERA = {
  uid: 'item-1',
  name: 'Playera',
  sku: 'PARENT-1',
  url: '/ebay-1-playera.html',
  thumbnailUrl: 'https://chupaprecios.com.mx/media/a.jpg',
  quantity: 3,
  unitPrice: { amount: 516.17, currency: 'MXN' },
  options: [{ label: 'Talla', value: 'M' }],
  outOfStock: false,
};

const LAMPARA = {
  uid: 'item-2',
  name: 'Lámpara',
  sku: 'B0LAMP',
  url: '/amazon-B0LAMP-lampara.html',
  thumbnailUrl: null,
  quantity: 1,
  unitPrice: { amount: 250, currency: 'MXN' },
  options: [],
  outOfStock: false,
};

const CART = {
  totalQuantity: 3,
  subtotal: { amount: 1548.5, currency: 'MXN' },
  items: [PLAYERA],
};

const TWO_ITEMS = {
  totalQuantity: 4,
  subtotal: { amount: 1798.5, currency: 'MXN' },
  items: [PLAYERA, LAMPARA],
};

const trigger = () => screen.getByRole('button', { name: /mini carrito/i });
const panel = () => screen.getByRole('region', { name: 'Carrito' });

function storeCart(): void {
  window.localStorage.setItem(CART_KEY, encodePersisted('pwa-cart', Date.now()));
}

async function openWith(cart: unknown): Promise<HTMLElement> {
  storeCart();
  actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 3 });
  actions.getMiniCartAction.mockResolvedValue({ status: 'ok', cart });
  await act(async () => render(<MiniCart />));
  await act(async () => fireEvent.click(trigger()));
  return panel();
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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
    storeCart();
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 120 });

    await act(async () => render(<MiniCart />));

    expect(actions.getCartCountAction).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: null,
    });
    expect(screen.getByTestId('cart-count').textContent).toBe('99+');
  });

  it('never lets a late initial count overwrite a newer count from add to cart', async () => {
    storeCart();
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
    storeCart();
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

  it('is the DS "Carrito (N)" action: cart icon, label and count, a disclosure of the panel', async () => {
    await act(async () => render(<MiniCart />));
    act(() => cartCountStore.set(2));

    const button = trigger();
    expect(button.getAttribute('aria-label')).toBe(
      'Alternar mini carrito. Tienes 2 artículos en tu carrito.',
    );
    // A disclosure (PWA dropdown), not a dialog popup.
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const controlled = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(controlled?.getAttribute('data-slot')).toBe('mini-cart-panel');
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

  it('links to /cart below 1160px and opens the dropdown from 1160px (PWA cart trigger)', async () => {
    await act(async () => render(<MiniCart />));
    act(() => cartCountStore.set(2));

    // jsdom has no layout: assert both renders and their breakpoint classes.
    const link = screen.getByRole('link', { name: /^Carrito\. Tienes 2 artículos/ });
    expect(link.getAttribute('href')).toBe('/cart');
    expect(link.className).toContain('min-[1160px]:hidden');
    expect(within(link).getByText('Carrito')).toBeTruthy();
    expect(within(link).getByText('2')).toBeTruthy();

    const container = trigger().closest<HTMLElement>('[data-slot="mini-cart"]')!;
    expect(container.className).toContain('hidden');
    expect(container.className).toContain('min-[1160px]:flex');
    expect(container.className).toContain('relative');
    expect(container.querySelector('[data-slot="mini-cart-panel"]')).toBeTruthy();
    expect(link.contains(container)).toBe(false);
  });

  it('opens a non-modal panel under the trigger: head, PWA rows, subtotal and "Ir a pagar"', async () => {
    const view = within(await openWith(CART));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal]')).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const root = panel();
    expect(root.className).toContain('top-full');
    expect(root.className).toContain('opacity-100');
    // Head: the title and the PWA "Editar carrito" link to the PWA cart; no close button.
    expect(view.getByRole('heading', { level: 2, name: 'Carrito (3 artículos)' })).toBeTruthy();
    const edit = view.getByRole('link', { name: 'Editar carrito' });
    expect(edit.getAttribute('href')).toBe('/cart');
    expect(edit.closest('[data-slot="mini-cart-head"]')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Cerrar carrito' })).toBeNull();
    // PWA rows: image + name links to the product, "Cantidad", price, trash button; no options.
    const items = view.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const row = within(items[0]!);
    expect(row.getByRole('link', { name: 'Playera' }).getAttribute('href')).toBe(
      '/ebay-1-playera.html',
    );
    const image = items[0]!.querySelector('img')!;
    expect(image.closest('a')?.getAttribute('href')).toBe('/ebay-1-playera.html');
    expect(image.className).toContain('object-cover');
    expect(row.queryByText('Talla: M')).toBeNull();
    expect(row.getByText('Cantidad: 3')).toBeTruthy();
    expect(row.getByText(/516\.17/)).toBeTruthy();
    expect(row.getByRole('button', { name: 'Eliminar Playera' })).toBeTruthy();
    // Footer: subtotal and the main CTA to checkout, PWA high-priority weight and border.
    const footer = root.querySelector<HTMLElement>('[data-slot="mini-cart-footer"]')!;
    expect(within(footer).getByText('Subtotal (3 art.):')).toBeTruthy();
    expect(within(footer).getByText(/1,548\.50/)).toBeTruthy();
    const checkout = within(footer).getByRole('link', { name: 'Ir a pagar' });
    expect(checkout.getAttribute('href')).toBe('/checkout');
    expect(checkout.className).toContain('font-bold!');
    expect(checkout.className).toContain('border-2!');
    expect(view.queryByRole('link', { name: 'Ver carrito' })).toBeNull();

    // The trigger toggles it closed; the closed panel leaves the accessibility tree.
    await act(async () => fireEvent.click(trigger()));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Carrito' })).toBeNull();
    const closed = document.querySelector<HTMLElement>('[data-slot="mini-cart-panel"]')!;
    expect(closed.getAttribute('aria-hidden')).toBe('true');
    expect(closed.className).toContain('invisible');
  });

  it('shows the PWA stock message when an item is out of stock, and the singular title', async () => {
    const view = within(
      await openWith({
        ...CART,
        totalQuantity: 1,
        items: [{ ...PLAYERA, quantity: 1, outOfStock: true }],
      }),
    );

    expect(view.getByRole('heading', { name: 'Carrito (1 artículo)' })).toBeTruthy();
    const message = view.getByText(
      'Un artículo en tu carrito está agotado actualmente y debe eliminarse para proceder al pago.',
    );
    expect(message.closest('[data-slot="mini-cart-stock"]')).toBeTruthy();
    // The PWA row itself shows no stock label.
    expect(view.queryByText('Agotado')).toBeNull();
    expect(view.getByText('Subtotal (1 art.):')).toBeTruthy();
  });

  it('shows no stock message when everything is in stock', async () => {
    const root = await openWith(CART);
    expect(root.querySelector('[data-slot="mini-cart-stock"]')).toBeNull();
  });

  it('Escape closes the panel, marks the key handled and gives focus back to the trigger', async () => {
    const root = await openWith(CART);
    const edit = within(root).getByRole('link', { name: 'Editar carrito' });
    edit.focus();

    const notPrevented = fireEvent.keyDown(edit, { key: 'Escape' });

    expect(notPrevented).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('ignores an Escape another layer already handled', async () => {
    const root = await openWith(CART);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    act(() => {
      root.dispatchEvent(event);
    });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on a pointer down outside, not on one inside the panel', async () => {
    const root = await openWith(CART);

    fireEvent.pointerDown(root);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('locks the page scroll while open and restores it on close', async () => {
    document.body.style.overflow = 'scroll';
    await openWith(CART);
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => fireEvent.click(trigger()));
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('shows only the centered status while the first load runs (no head)', async () => {
    storeCart();
    actions.getCartCountAction.mockResolvedValue({ status: 'ok', totalQuantity: 3 });
    actions.getMiniCartAction.mockReturnValue(new Promise(() => {}));
    await act(async () => render(<MiniCart />));

    await act(async () => fireEvent.click(trigger()));

    const view = within(panel());
    expect(view.getByRole('status').textContent).toBe('Cargando tu carrito...');
    expect(view.queryByRole('heading')).toBeNull();
    expect(view.queryByRole('link', { name: 'Editar carrito' })).toBeNull();
  });

  it('keeps the items while reopening refreshes them and fades the subtotal (PWA loading)', async () => {
    await openWith(CART);
    await act(async () => fireEvent.click(trigger()));
    actions.getMiniCartAction.mockReturnValue(new Promise(() => {}));

    await act(async () => fireEvent.click(trigger()));

    const root = panel();
    expect(within(root).getByRole('link', { name: 'Playera' })).toBeTruthy();
    const price = within(root)
      .getByText(/1,548\.50/)
      .closest<HTMLElement>('[data-slot="subtotal-price"]')!;
    expect(price.className).toContain('opacity-50');
    // "Editar carrito" and the CTA are disabled while loading, as in the PWA.
    expect(within(root).queryByRole('link', { name: 'Editar carrito' })).toBeNull();
    expect(within(root).getByText('Editar carrito').getAttribute('aria-disabled')).toBe('true');
    expect(within(root).queryByRole('link', { name: 'Ir a pagar' })).toBeNull();
  });

  it('shows only the empty message without a cart (no head, no CTAs)', async () => {
    await act(async () => render(<MiniCart />));
    await act(async () => fireEvent.click(trigger()));
    const view = within(panel());
    expect(view.getByText('No hay artículos en tu carrito.')).toBeTruthy();
    expect(view.queryByRole('heading')).toBeNull();
    expect(view.queryByRole('link', { name: 'Ir a pagar' })).toBeNull();
    expect(view.queryByRole('link', { name: 'Editar carrito' })).toBeNull();
    expect(actions.getMiniCartAction).not.toHaveBeenCalled();
  });

  it('offers a retry when the cart cannot be loaded', async () => {
    storeCart();
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

  describe('remove', () => {
    it('removes the item, busy meanwhile, then shows the updated list and count', async () => {
      const root = await openWith(TWO_ITEMS);
      const pending = deferred<unknown>();
      actions.removeCartItemAction.mockReturnValue(pending.promise);

      const remove = within(root).getByRole('button', { name: 'Eliminar Playera' });
      remove.focus();
      await act(async () => fireEvent.click(remove));

      expect(actions.removeCartItemAction).toHaveBeenCalledWith({
        cartId: 'pwa-cart',
        signinToken: null,
        itemUid: 'item-1',
      });
      expect(remove.getAttribute('aria-disabled')).toBe('true');
      expect(remove.getAttribute('aria-busy')).toBe('true');
      expect(remove.closest('li')?.className).toContain('opacity-50');
      // The other rows wait too, and the subtotal fades as in the PWA loading state.
      expect(
        within(root)
          .getByRole('button', { name: 'Eliminar Lámpara' })
          .getAttribute('aria-disabled'),
      ).toBe('true');
      expect(root.querySelector('[data-slot="subtotal-price"]')?.className).toContain('opacity-50');
      // A second click while busy sends nothing.
      await act(async () => fireEvent.click(remove));
      expect(actions.removeCartItemAction).toHaveBeenCalledTimes(1);

      await act(async () =>
        pending.resolve({
          status: 'ok',
          cart: { totalQuantity: 1, subtotal: { amount: 250, currency: 'MXN' }, items: [LAMPARA] },
        }),
      );

      expect(within(root).queryByRole('link', { name: 'Playera' })).toBeNull();
      expect(within(root).getByRole('heading', { name: 'Carrito (1 artículo)' })).toBeTruthy();
      expect(screen.getByTestId('cart-count').textContent).toBe('1');
      expect(cartCountStore.get()).toBe(1);
      const left = within(root).getByRole('button', { name: 'Eliminar Lámpara' });
      expect(left.getAttribute('aria-disabled')).toBeNull();
      // Focus stays inside the open panel (the removed button is gone).
      expect(root.contains(document.activeElement)).toBe(true);
    });

    it('shows the empty message and no count after removing the last item', async () => {
      const root = await openWith(CART);
      actions.removeCartItemAction.mockResolvedValue({
        status: 'ok',
        cart: { totalQuantity: 0, subtotal: { amount: 0, currency: 'MXN' }, items: [] },
      });

      await act(async () =>
        fireEvent.click(within(root).getByRole('button', { name: 'Eliminar Playera' })),
      );

      expect(within(root).getByText('No hay artículos en tu carrito.')).toBeTruthy();
      expect(within(root).queryByRole('heading')).toBeNull();
      expect(screen.queryByTestId('cart-count')).toBeNull();
    });

    it('keeps the item and shows an inline alert when the removal fails', async () => {
      const root = await openWith(TWO_ITEMS);
      actions.removeCartItemAction.mockResolvedValue({ status: 'failed' });

      await act(async () =>
        fireEvent.click(within(root).getByRole('button', { name: 'Eliminar Playera' })),
      );

      expect(within(root).getByRole('alert').textContent).toBe(
        'No pudimos eliminar el artículo. Inténtalo de nuevo.',
      );
      const remove = within(root).getByRole('button', { name: 'Eliminar Playera' });
      expect(remove.getAttribute('aria-disabled')).toBeNull();
      expect(cartCountStore.get()).toBe(4);

      // A rejected action is reported the same way; a later success clears the alert.
      actions.removeCartItemAction.mockRejectedValueOnce(new Error('network'));
      await act(async () => fireEvent.click(remove));
      expect(within(root).getByRole('alert')).toBeTruthy();
      actions.removeCartItemAction.mockResolvedValueOnce({ status: 'ok', cart: CART });
      await act(async () => fireEvent.click(remove));
      expect(within(root).queryByRole('alert')).toBeNull();
    });

    it('empties the panel and the count when Magento rejects the cart', async () => {
      const root = await openWith(CART);
      actions.removeCartItemAction.mockResolvedValue({ status: 'invalid_cart' });

      await act(async () =>
        fireEvent.click(within(root).getByRole('button', { name: 'Eliminar Playera' })),
      );

      expect(within(root).getByText('No hay artículos en tu carrito.')).toBeTruthy();
      expect(cartCountStore.get()).toBe(0);
    });
  });
});
