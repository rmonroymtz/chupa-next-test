'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MiniCart as MiniCartData } from '@/modules/cart/application/ports';
import { getCartCountAction, getMiniCartAction } from '@/modules/cart/ui/cart-actions';
import { cartCountStore, useCartCount } from '@/modules/cart/ui/cart-store';
import { MiniCartItem } from '@/modules/cart/ui/mini-cart-item';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { formatPrice } from '@/modules/product/ui/format-price';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';

/** PWA Studio pages: plain anchors so the edge routes them to PWA Studio. */
const CART_PATH = '/cart';
const CHECKOUT_PATH = '/checkout';

type Contents =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly cart: MiniCartData | null };

/**
 * Header cart trigger and mini cart (legacy `CartTrigger` + `MiniCart`). The
 * count comes from the PWA cart on load (legacy `getItemCount`) and from the
 * add-to-cart island afterwards; the items are read when the drawer opens.
 * A cart Magento rejects shows as empty and is left in storage: the next add
 * to cart (or PWA Studio itself) replaces it.
 *
 * The drawer is the DS `.miniCart` panel (PWA `MiniCart`): a 360px floating
 * surface with a head ("Carrito (N artículos)" + "Editar carrito" to the PWA
 * cart + close), the scrolling item rows, and a footer with the subtotal and
 * the main CTA "Ir a pagar" to checkout. It stays a native modal dialog.
 */
export function MiniCart() {
  const count = useCartCount();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [contents, setContents] = useState<Contents>({ kind: 'loading' });
  const [announcement, setAnnouncement] = useState('');
  const knownCount = useRef<number | null>(null);

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
    if (!cartId) {
      setContents({ kind: 'ready', cart: null });
      return;
    }
    setContents({ kind: 'loading' });
    const version = cartCountStore.version();
    try {
      const result = await getMiniCartAction({
        cartId,
        signinToken: browserCartStorage.readSigninToken(),
      });
      if (result.status === 'ok') {
        cartCountStore.setIfUnchangedSince(version, result.cart.totalQuantity);
        setContents({ kind: 'ready', cart: result.cart });
      } else if (result.status === 'invalid_cart') {
        cartCountStore.setIfUnchangedSince(version, 0);
        setContents({ kind: 'ready', cart: null });
      } else {
        setContents({ kind: 'error' });
      }
    } catch {
      setContents({ kind: 'error' });
    }
  }, []);

  function openDrawer(): void {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Native modal dialog: focus moves in, is trapped, and Escape closes it.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setOpen(true);
    void load();
  }

  function closeDrawer(): void {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    setOpen(false);
  }

  const total = count ?? 0;
  const display = total > 99 ? '99+' : String(total);

  return (
    <>
      <button
        type="button"
        aria-label={`Alternar mini carrito. Tienes ${total} artículos en tu carrito.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closeDrawer() : openDrawer())}
        data-slot="cart-trigger"
        className="relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-xs text-body-sm font-medium text-ds-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus lg:min-w-0"
      >
        <Icon name="shopping-cart" size={16} className="text-ds-neutral-950 lg:size-3.5" />
        {/* DS action label from 1024; icon only below, with the count as a badge. */}
        <span className="hidden lg:inline">Carrito</span>
        {total > 0 ? (
          <span
            data-testid="cart-count"
            aria-hidden="true"
            className="absolute top-1.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-pill bg-ds-cta px-1 text-[0.625rem] leading-none font-semibold text-ds-text-on-cta lg:static lg:block lg:h-auto lg:min-w-0 lg:rounded-none lg:bg-transparent lg:p-0 lg:text-body-sm lg:font-medium lg:text-ds-text lg:before:content-['('] lg:after:content-[')']"
          >
            {display}
          </span>
        ) : null}
      </button>
      <span data-testid="cart-count-announcer" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          // Close here and mark Escape handled, so the document-level Escape of
          // other layers (the categories dropdown) leaves it alone.
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed top-3 right-3 bottom-auto left-auto m-0 h-auto max-h-[min(35rem,calc(100dvh-1.5rem))] w-[min(22.5rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-lg border border-ds-border-subtle bg-ds-surface p-0 text-ds-text shadow-elevation-3 backdrop:bg-ds-overlay"
      >
        <div className="flex max-h-[inherit] flex-col">
          <div
            data-slot="mini-cart-head"
            className="flex shrink-0 items-center gap-3 border-b border-ds-border-subtle py-2 pr-2 pl-4"
          >
            <h2
              id={titleId}
              className="min-w-0 flex-1 truncate text-body-md font-bold tracking-[0.02em] uppercase"
            >
              {title(contents)}
            </h2>
            {hasItems(contents) ? (
              <a
                href={CART_PATH}
                className="inline-flex min-h-8 items-center rounded-xs text-body-sm font-semibold whitespace-nowrap text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
              >
                Editar carrito
              </a>
            ) : null}
            <button
              type="button"
              aria-label="Cerrar carrito"
              onClick={closeDrawer}
              className="grid size-11 shrink-0 place-items-center rounded-full text-ds-text hover:bg-ds-surface-subtle focus-visible:outline-2 focus-visible:outline-ds-focus"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          <MiniCartBody contents={contents} onRetry={() => void load()} />
        </div>
      </dialog>
    </>
  );
}

function hasItems(contents: Contents): contents is { kind: 'ready'; cart: MiniCartData } {
  return contents.kind === 'ready' && contents.cart !== null && contents.cart.items.length > 0;
}

/** PWA head title, "Carrito (N artículos)"; just "Carrito" until the items are known. */
function title(contents: Contents): string {
  if (!hasItems(contents)) return 'Carrito';
  const quantity = contents.cart.totalQuantity;
  return `Carrito (${quantity} ${quantity === 1 ? 'artículo' : 'artículos'})`;
}

function MiniCartBody({ contents, onRetry }: { contents: Contents; onRetry(): void }) {
  if (contents.kind === 'loading') {
    return (
      <p role="status" className="px-4 py-8 text-center text-body-md text-ds-text-secondary">
        Cargando tu carrito...
      </p>
    );
  }
  if (contents.kind === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-body-md font-semibold text-ds-text">No pudimos cargar tu carrito.</p>
        <Button variant="secondary" size="md" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!hasItems(contents)) {
    return (
      <p className="px-4 py-8 text-center text-body-md font-semibold text-ds-text-secondary">
        No hay artículos en tu carrito.
      </p>
    );
  }
  const { cart } = contents;
  return (
    <>
      <ul className="min-h-32 flex-1 divide-y divide-ds-border-subtle overflow-y-auto px-4">
        {cart.items.map((item) => (
          <MiniCartItem key={item.uid} item={item} />
        ))}
      </ul>
      <div
        data-slot="mini-cart-footer"
        className="flex shrink-0 flex-col gap-3 border-t border-ds-border-subtle bg-ds-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {cart.subtotal ? (
          <p className="flex items-baseline justify-between gap-2 text-[0.9375rem] font-bold text-ds-text">
            <span>Subtotal ({cart.totalQuantity} art.):</span>
            <span>{formatPrice(cart.subtotal.amount, cart.subtotal.currency)}</span>
          </p>
        ) : null}
        <Button href={CHECKOUT_PATH} nativeAnchor size="lg" className="w-full">
          Ir a pagar
        </Button>
      </div>
    </>
  );
}
