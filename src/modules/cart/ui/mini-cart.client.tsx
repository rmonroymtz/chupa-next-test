'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MiniCart as MiniCartData } from '@/modules/cart/application/ports';
import { getCartCountAction, getMiniCartAction } from '@/modules/cart/ui/cart-actions';
import { cartCountStore, useCartCount } from '@/modules/cart/ui/cart-store';
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
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(24rem,90vw)] max-w-none bg-white p-0 text-ds-text shadow-elevation-1 backdrop:bg-ds-overlay"
      >
        <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between border-b border-ds-border-subtle px-4 py-3">
            <h2 id={titleId} className="text-base font-semibold">
              Carrito de compras
            </h2>
            <button
              type="button"
              aria-label="Cerrar carrito"
              onClick={closeDrawer}
              className="grid size-11 place-items-center rounded-full text-2xl leading-none focus-visible:outline-2 focus-visible:outline-ds-focus"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <MiniCartBody contents={contents} onRetry={() => void load()} />
        </div>
      </dialog>
    </>
  );
}

function MiniCartBody({ contents, onRetry }: { contents: Contents; onRetry(): void }) {
  if (contents.kind === 'loading') {
    return (
      <p role="status" className="px-4 py-6 text-sm">
        Cargando tu carrito...
      </p>
    );
  }
  if (contents.kind === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6 text-sm">
        <p>No pudimos cargar tu carrito.</p>
        <Button variant="secondary" size="lg" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }
  const { cart } = contents;
  if (!cart || cart.items.length === 0) {
    return <p className="px-4 py-6 text-sm">No hay artículos en tu carrito.</p>;
  }
  return (
    <>
      <div className="flex items-baseline justify-between gap-2 px-4 py-3 text-sm">
        <span>{cart.totalQuantity} productos</span>
        {cart.subtotal ? (
          <span className="font-semibold">
            Subtotal: {formatPrice(cart.subtotal.amount, cart.subtotal.currency)}
          </span>
        ) : null}
      </div>
      <ul className="flex-1 divide-y divide-ds-border-subtle overflow-y-auto px-4">
        {cart.items.map((item) => (
          <li key={item.uid} className="flex gap-3 py-3">
            {item.thumbnailUrl ? (
              <Image
                src={item.thumbnailUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                loading="lazy"
                className="size-16 shrink-0 object-contain"
              />
            ) : (
              <span className="size-16 shrink-0 bg-ds-surface-subtle" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <a href={item.url} className="line-clamp-2 font-semibold hover:underline">
                {item.name}
              </a>
              {item.options.map((option) => (
                <span key={option.label} className="text-ds-text-secondary">
                  {option.label}: {option.value}
                </span>
              ))}
              {item.outOfStock ? <span className="text-ds-text-error">Agotado</span> : null}
              <span>Cantidad: {item.quantity}</span>
              {item.unitPrice ? (
                <span>{formatPrice(item.unitPrice.amount, item.unitPrice.currency)}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-ds-border-subtle p-4">
        <Button href={CHECKOUT_PATH} nativeAnchor size="lg">
          Finalizar compra
        </Button>
        <Button href={CART_PATH} nativeAnchor variant="secondary" size="lg">
          Ver carrito
        </Button>
      </div>
    </>
  );
}
