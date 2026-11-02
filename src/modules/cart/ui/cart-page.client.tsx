'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CartDetails, CartDetailsItem } from '@/modules/cart/application/ports';
import {
  cartHeading,
  hasOutOfStockItem,
  OUT_OF_STOCK_MESSAGE,
  partitionCartItems,
} from '@/modules/cart/domain/cart-page';
import {
  getCartDetailsAction,
  removeCartDetailsItemAction,
  updateCartItemAction,
} from '@/modules/cart/ui/cart-actions';
import { CartPageItem } from '@/modules/cart/ui/cart-page-item';
import { CartPageSummary } from '@/modules/cart/ui/cart-page-summary';
import { cartCountStore } from '@/modules/cart/ui/cart-store';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { Button } from '@/shared/ui/button';

type Contents =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly cart: CartDetails | null };

type Notice = 'update_failed' | 'remove_failed' | null;

const NOTICES = {
  update_failed: 'No pudimos actualizar tu carrito. Inténtalo de nuevo.',
  remove_failed: 'No pudimos eliminar el artículo. Inténtalo de nuevo.',
} as const;

/** One read of the PWA cart; `count` is the header count to publish, null when it stays unknown. */
async function readContents(): Promise<{ contents: Contents; count: number | null }> {
  const cartId = browserCartStorage.readCartId();
  if (!cartId) return { contents: { kind: 'ready', cart: null }, count: 0 };
  try {
    const result = await getCartDetailsAction({
      cartId,
      signinToken: browserCartStorage.readSigninToken(),
    });
    if (result.status === 'ok') {
      return { contents: { kind: 'ready', cart: result.cart }, count: result.cart.totalQuantity };
    }
    if (result.status === 'invalid_cart')
      return { contents: { kind: 'ready', cart: null }, count: 0 };
  } catch {
    // Falls through to the error state.
  }
  return { contents: { kind: 'error' }, count: null };
}

/**
 * The `/cart` page body (legacy `CartPage`). The cart id and the sign-in
 * token live in the PWA's localStorage, so the cart is read in the browser
 * through the Server Actions, like the mini cart. A missing cart or one
 * Magento rejects is the empty state (legacy `hasItems` is false); a failed
 * read is an error with a retry. Every response is the whole updated cart and
 * replaces what is shown; only the latest request may write it.
 */
export function CartPage() {
  const [contents, setContents] = useState<Contents>({ kind: 'loading' });
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const latestRequest = useRef(0);

  // Nothing is set before the first await, so the mount effect never sets state synchronously.
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    const version = cartCountStore.version();
    const { contents: next, count } = await readContents();
    if (request !== latestRequest.current) return;
    if (count !== null) cartCountStore.setIfUnchangedSince(version, count);
    setContents(next);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function retry(): void {
    setContents({ kind: 'loading' });
    void load();
  }

  async function mutate(
    item: CartDetailsItem,
    failure: Exclude<Notice, null>,
    run: (auth: {
      cartId: string;
      signinToken: string | null;
    }) => ReturnType<typeof removeCartDetailsItemAction>,
  ): Promise<void> {
    const cartId = browserCartStorage.readCartId();
    if (!cartId) {
      setContents({ kind: 'ready', cart: null });
      return;
    }
    const request = ++latestRequest.current;
    setPendingUid(item.uid);
    setNotice(null);
    try {
      const result = await run({ cartId, signinToken: browserCartStorage.readSigninToken() });
      if (request !== latestRequest.current) return;
      if (result.status === 'failed') {
        setNotice(failure);
        return;
      }
      const cart = result.status === 'ok' ? result.cart : null;
      // A change is newer than any count read in flight.
      cartCountStore.set(cart?.totalQuantity ?? 0);
      setContents({ kind: 'ready', cart });
    } catch {
      if (request === latestRequest.current) setNotice(failure);
    } finally {
      setPendingUid(null);
    }
  }

  if (contents.kind === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-ds-text-secondary">
        Cargando tu carrito…
      </p>
    );
  }

  if (contents.kind === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-ds-text">No pudimos cargar tu carrito. Inténtalo de nuevo.</p>
        <Button onClick={retry}>Reintentar</Button>
      </div>
    );
  }

  const cart = contents.cart;
  if (!cart || cart.items.length === 0) return <EmptyCart />;

  const { regular, quotes } = partitionCartItems(cart.items);
  const busy = pendingUid !== null;

  const renderItem = (item: CartDetailsItem) => (
    <CartPageItem
      key={item.uid}
      item={item}
      updating={pendingUid === item.uid}
      busy={busy}
      onQuantityChange={(target, quantity) =>
        void mutate(target, 'update_failed', (auth) =>
          updateCartItemAction({ ...auth, itemUid: target.uid, quantity }),
        )
      }
      onRemove={(target) =>
        void mutate(target, 'remove_failed', (auth) =>
          removeCartDetailsItemAction({ ...auth, itemUid: target.uid }),
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 aria-live="polite" className="text-2xl font-bold text-ds-text">
          {cartHeading(cart.items)}
        </h1>
        {hasOutOfStockItem(cart.items) ? (
          <p className="text-sm text-ds-text-error">{OUT_OF_STOCK_MESSAGE}</p>
        ) : null}
        {notice ? (
          <p role="alert" className="text-sm text-ds-text-error">
            {NOTICES[notice]}
          </p>
        ) : null}
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {regular.length > 0 ? (
            <ItemSection title="Productos en tu carrito">{regular.map(renderItem)}</ItemSection>
          ) : null}
          {quotes.length > 0 ? (
            <ItemSection title="Productos en tus cotizaciones">
              {quotes.map(renderItem)}
            </ItemSection>
          ) : null}
        </div>
        <CartPageSummary summary={cart.summary} updating={busy} />
      </div>
    </div>
  );
}

function ItemSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="border-b border-ds-border-subtle pb-3 text-lg font-semibold text-ds-text">
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="sr-only">Mi carrito</h1>
      <h2 className="text-xl font-bold text-ds-text">Tu carrito está vacío</h2>
      <p className="max-w-md text-ds-text-secondary">
        Tenemos millones de productos, estamos seguros de que encontrarás lo que estás buscando
      </p>
      <Link
        href="/"
        className="rounded-xs font-semibold text-ds-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
      >
        Continuar comprando →
      </Link>
    </div>
  );
}
