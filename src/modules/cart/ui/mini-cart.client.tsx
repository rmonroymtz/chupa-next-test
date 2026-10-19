'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  MiniCart as MiniCartData,
  MiniCartItem as MiniCartItemData,
} from '@/modules/cart/application/ports';
import {
  getCartCountAction,
  getMiniCartAction,
  removeCartItemAction,
} from '@/modules/cart/ui/cart-actions';
import { cartCountStore, useCartCount } from '@/modules/cart/ui/cart-store';
import { MiniCartItem } from '@/modules/cart/ui/mini-cart-item';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { formatPrice } from '@/modules/product/ui/format-price';
import { Button } from '@/shared/ui/button';
import { cx } from '@/shared/ui/class-names';
import { DESKTOP_MEDIA_QUERY } from '@/shared/ui/breakpoints';
import { Icon } from '@/shared/ui/icon';

/** PWA Studio pages: plain anchors so the edge routes them to PWA Studio. */
const CART_PATH = '/cart';
const CHECKOUT_PATH = '/checkout';

/** PWA cart trigger switch (`cartTrigger.module.css`): link below, dropdown from here (the header switch). */
const DROPDOWN_QUERY = DESKTOP_MEDIA_QUERY;
/** PWA `MiniCart` viewport fit: the panel keeps this gap above the viewport bottom. */
const VIEWPORT_MARGIN_BOTTOM = 15;

const STOCK_MESSAGE =
  'Un artículo en tu carrito está agotado actualmente y debe eliminarse para proceder al pago.';
const REMOVE_ERROR = 'No pudimos eliminar el artículo. Inténtalo de nuevo.';

/**
 * PWA `cartTrigger.module.css` `.action`: 20px icon, 8px gap, 14px
 * text-primary label ("Carrito (N)", also "(0)") from 1160, brand anchor on
 * hover. The label keeps its color with items (the PWA has no has-items state).
 * Below 1160 icon only, plus the count badge (a Next extra).
 */
const TRIGGER_CLASSES =
  'relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-xs text-body-md leading-normal text-ds-text hover:text-ds-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus desktop:min-w-0';

type Contents =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | {
      readonly kind: 'ready';
      readonly cart: MiniCartData | null;
      /** Reopened: the last cart stays visible while it is read again (PWA cache-and-network). */
      readonly refreshing: boolean;
    };

/**
 * Header cart trigger and mini cart, the PWA `Header/cartTrigger` +
 * `MiniCart`. The count comes from the PWA cart on load (legacy
 * `getItemCount`) and from the add-to-cart island afterwards; the items are
 * read when the panel opens. A cart Magento rejects shows as empty and is left
 * in storage: the next add to cart (or PWA Studio itself) replaces it.
 *
 * Below 1160px the trigger is a link to the PWA cart. From 1160px it toggles
 * the PWA dropdown: a non-modal 360px panel right-aligned under the trigger
 * (fade, page scroll locked, height fitted to the viewport) with the head
 * ("Carrito (N artículos)" + "Editar carrito"), the stock message, the item
 * rows with their remove button, and the subtotal + "Ir a pagar" footer. It
 * is a disclosure: Escape closes it (focus back to the trigger), and so does a
 * pointer down outside.
 */
export function MiniCart() {
  const count = useCartCount();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentsRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [contents, setContents] = useState<Contents>({ kind: 'loading' });
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const knownCount = useRef<number | null>(null);
  // Only the latest panel request (read or removal) may write the contents.
  const latestRequest = useRef(0);

  useEffect(() => {
    const cartId = browserCartStorage.readCartId();
    if (!cartId) {
      cartCountStore.set(0);
      return;
    }
    let cancelled = false;
    const version = cartCountStore.version();
    getCartCountAction({ cartId, signinToken: browserCartStorage.readSigninToken() })
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok')
          cartCountStore.setIfUnchangedSince(version, result.totalQuantity);
        else if (result.status === 'invalid_cart') cartCountStore.setIfUnchangedSince(version, 0);
      })
      .catch(() => {
        // The count stays unknown; the trigger still opens the mini cart.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Announce changes after the first known count (not the initial load).
  useEffect(() => {
    if (count === null) return;
    if (knownCount.current !== null && knownCount.current !== count) {
      setAnnouncement(`${count} ${count === 1 ? 'artículo' : 'artículos'} en tu carrito`);
    }
    knownCount.current = count;
  }, [count]);

  const load = useCallback(async () => {
    const cartId = browserCartStorage.readCartId();
    const request = ++latestRequest.current;
    if (!cartId) {
      setContents({ kind: 'ready', cart: null, refreshing: false });
      return;
    }
    setRemoveFailed(false);
    setContents((current) =>
      current.kind === 'ready' && current.cart
        ? { ...current, refreshing: true }
        : { kind: 'loading' },
    );
    const version = cartCountStore.version();
    try {
      const result = await getMiniCartAction({
        cartId,
        signinToken: browserCartStorage.readSigninToken(),
      });
      if (request !== latestRequest.current) return;
      if (result.status === 'ok') {
        cartCountStore.setIfUnchangedSince(version, result.cart.totalQuantity);
        setContents({ kind: 'ready', cart: result.cart, refreshing: false });
      } else if (result.status === 'invalid_cart') {
        cartCountStore.setIfUnchangedSince(version, 0);
        setContents({ kind: 'ready', cart: null, refreshing: false });
      } else {
        setContents({ kind: 'error' });
      }
    } catch {
      if (request === latestRequest.current) setContents({ kind: 'error' });
    }
  }, []);

  async function remove(item: MiniCartItemData): Promise<void> {
    const cartId = browserCartStorage.readCartId();
    if (!cartId) {
      setContents({ kind: 'ready', cart: null, refreshing: false });
      return;
    }
    const request = ++latestRequest.current;
    setRemovingUid(item.uid);
    setRemoveFailed(false);
    try {
      const result = await removeCartItemAction({
        cartId,
        signinToken: browserCartStorage.readSigninToken(),
        itemUid: item.uid,
      });
      if (request !== latestRequest.current) return;
      if (result.status === 'failed') {
        setRemoveFailed(true);
        return;
      }
      // The removed row (and its focused button) goes away: keep focus in the panel.
      if (contentsRef.current?.contains(document.activeElement)) {
        contentsRef.current.focus({ preventScroll: true });
      }
      const cart = result.status === 'ok' ? result.cart : null;
      // A removal is newer than any count read in flight, as an add to cart is.
      cartCountStore.set(cart?.totalQuantity ?? 0);
      setContents({ kind: 'ready', cart, refreshing: false });
    } catch {
      if (request === latestRequest.current) setRemoveFailed(true);
    } finally {
      setRemovingUid(null);
    }
  }

  const close = useCallback(() => setOpen(false), []);

  function toggle(): void {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    void load();
  }

  // PWA `useScrollLock`: the page does not scroll under the open panel.
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // PWA `useDropdown`: a pointer down outside the trigger and the panel closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Below 1160px the dropdown container is not displayed: close instead of staying open unseen.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const dropdown = window.matchMedia(DROPDOWN_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      if (!event.matches) close();
    };
    dropdown.addEventListener('change', onChange);
    return () => dropdown.removeEventListener('change', onChange);
  }, [open, close]);

  // PWA `MiniCart` height fit: shrink to the viewport (15px margin) and scroll inside.
  useEffect(() => {
    const element = contentsRef.current;
    if (!open || !element) return;
    const adjustHeight = (): void => {
      const rect = element.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < VIEWPORT_MARGIN_BOTTOM) {
        element.style.height = `${window.innerHeight - VIEWPORT_MARGIN_BOTTOM - rect.top}px`;
        element.style.overflowY = 'auto';
      } else {
        element.style.height = 'auto';
        element.style.overflowY = '';
      }
    };
    adjustHeight();
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [open, contents]);

  const total = count ?? 0;
  const busy = removingUid !== null || (contents.kind === 'ready' && contents.refreshing);

  return (
    <>
      <a
        href={CART_PATH}
        aria-label={`Carrito. Tienes ${total} artículos en tu carrito.`}
        data-slot="cart-link"
        className={cx(TRIGGER_CLASSES, 'desktop:hidden')}
      >
        <Icon name="shopping-cart" size={20} />
        {total > 0 ? (
          <span
            data-testid="cart-badge"
            aria-hidden="true"
            className="absolute top-1 right-0 grid h-4 min-w-4 place-items-center rounded-pill bg-ds-cta px-1 text-[0.625rem] leading-none font-semibold text-ds-text-on-cta"
          >
            {countLabel(total)}
          </span>
        ) : null}
      </a>
      <div
        ref={containerRef}
        data-slot="mini-cart"
        className="relative hidden items-center desktop:flex"
        onKeyDown={(event) => {
          // Mark Escape handled, so the document-level Escape of other layers
          // (the categories dropdown) leaves it alone.
          if (!open || event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          close();
          triggerRef.current?.focus();
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Alternar mini carrito. Tienes ${total} artículos en tu carrito.`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          data-slot="cart-trigger"
          className={TRIGGER_CLASSES}
        >
          <Icon name="shopping-cart" size={20} />
          <span aria-hidden="true" className="hidden whitespace-nowrap desktop:inline">
            Carrito (<span data-testid="cart-count">{countLabel(total)}</span>)
          </span>
        </button>
        <div
          id={panelId}
          data-slot="mini-cart-panel"
          aria-hidden={open ? undefined : true}
          inert={!open}
          className={cx(
            // PWA `.root`: under the trigger, right-aligned, opacity fade in 224ms / out 192ms.
            'absolute top-full right-0 z-[70] h-0 max-w-[100vw] overflow-visible transition-[opacity,visibility] motion-reduce:transition-none',
            open
              ? 'pointer-events-auto visible opacity-100 duration-[224ms] ease-[cubic-bezier(0,0,0.2,1)]'
              : 'pointer-events-none invisible opacity-0 duration-[192ms] ease-[cubic-bezier(0.4,0,1,1)]',
          )}
        >
          {/* The "Carrito" region is the sized card, not the zero-height wrapper, so it has a box. */}
          <section
            ref={contentsRef}
            aria-label="Carrito"
            tabIndex={-1}
            className="mt-3 flex max-h-[35rem] w-[360px] max-w-[100vw] flex-col overflow-hidden rounded-lg border border-ds-border-subtle bg-ds-surface text-ds-text shadow-elevation-3 outline-none"
          >
            <MiniCartContents
              contents={contents}
              busy={busy}
              removingUid={removingUid}
              removeFailed={removeFailed}
              onRemove={(item) => void remove(item)}
              onRetry={() => void load()}
            />
          </section>
        </div>
      </div>
      <span data-testid="cart-count-announcer" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

/** PWA `itemCountDisplay`: the count, "99+" past 99. */
function countLabel(total: number): string {
  return total > 99 ? '99+' : String(total);
}

/** PWA head title, "Carrito (N artículos)" (singular for one). */
function title(cart: MiniCartData): string {
  const quantity = cart.totalQuantity;
  return `Carrito (${quantity} ${quantity === 1 ? 'artículo' : 'artículos'})`;
}

/** PWA `.emptyCart`: the centered message, without head or footer. */
function Centered({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center px-4 py-8">{children}</div>;
}

interface MiniCartContentsProps {
  readonly contents: Contents;
  readonly busy: boolean;
  readonly removingUid: string | null;
  readonly removeFailed: boolean;
  onRemove(item: MiniCartItemData): void;
  onRetry(): void;
}

function MiniCartContents({
  contents,
  busy,
  removingUid,
  removeFailed,
  onRemove,
  onRetry,
}: MiniCartContentsProps) {
  if (contents.kind === 'loading') {
    return (
      <Centered>
        <p role="status" className="text-center text-body-md text-ds-text-secondary">
          Cargando tu carrito...
        </p>
      </Centered>
    );
  }
  if (contents.kind === 'error') {
    // Not in the PWA (it shows the empty message): kept as a resilience extra.
    return (
      <Centered>
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <p className="text-body-md font-semibold text-ds-text">No pudimos cargar tu carrito.</p>
          <Button variant="secondary" size="md" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </Centered>
    );
  }
  const { cart } = contents;
  if (!cart || cart.items.length === 0) {
    return (
      <Centered>
        <p className="text-center text-body-md font-semibold text-ds-text-secondary">
          No hay artículos en tu carrito.
        </p>
      </Centered>
    );
  }
  const editClasses =
    'rounded-xs text-[13px] font-semibold whitespace-nowrap text-ds-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';
  return (
    <>
      <div
        data-slot="mini-cart-head"
        className="flex items-baseline justify-between gap-3 border-b border-ds-border-subtle px-4 pt-4 pb-3"
      >
        <h2 className="text-[14px] font-bold tracking-[0.02em] text-ds-text uppercase">
          {title(cart)}
        </h2>
        {busy ? (
          // Disabled while loading, as the PWA button: no href, no link role.
          <a aria-disabled="true" className={cx(editClasses, 'cursor-default opacity-50')}>
            Editar carrito
          </a>
        ) : (
          <a href={CART_PATH} className={cx(editClasses, 'hover:underline')}>
            Editar carrito
          </a>
        )}
      </div>
      {cart.items.some((item) => item.outOfStock) ? (
        // PWA `StockStatusMessage` (venia: red-400 left border, red-700 text, 16px insets).
        <div data-slot="mini-cart-stock" className="px-4">
          <p className="border-l-4 border-solid border-[#f87171] py-4 pr-0 pl-4 text-[14px] leading-normal font-semibold text-[#b91c1c]">
            {STOCK_MESSAGE}
          </p>
        </div>
      ) : null}
      {removeFailed ? (
        // The PWA shows a toast; this storefront has none, so the alert stays in the panel.
        <p role="alert" className="mx-4 mt-3 text-body-sm font-semibold text-ds-text-error">
          {REMOVE_ERROR}
        </p>
      ) : null}
      <div className="min-h-32 flex-1 overflow-y-auto px-4">
        <ul className="mb-1 flex flex-col">
          {cart.items.map((item) => (
            <MiniCartItem
              key={item.uid}
              item={item}
              removing={item.uid === removingUid}
              busy={busy}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </div>
      <div
        data-slot="mini-cart-footer"
        className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t border-ds-border-subtle bg-ds-surface px-4 pt-3 pb-4"
      >
        {cart.subtotal ? (
          <p className="flex items-baseline justify-between text-[15px] font-bold text-ds-text">
            <span>Subtotal ({cart.totalQuantity} art.):</span>
            <span
              data-slot="subtotal-price"
              className={cx(
                'transition-opacity duration-[384ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
                busy ? 'opacity-50' : 'opacity-100',
              )}
            >
              {formatPrice(cart.subtotal.amount, cart.subtotal.currency)}
            </span>
          </p>
        ) : null}
        {/* PWA high-priority Button: bold label and a 2px border (call site only). */}
        <Button
          href={CHECKOUT_PATH}
          nativeAnchor
          size="lg"
          disabled={busy}
          className="w-full border-2! font-bold!"
        >
          Ir a pagar
        </Button>
      </div>
    </>
  );
}
