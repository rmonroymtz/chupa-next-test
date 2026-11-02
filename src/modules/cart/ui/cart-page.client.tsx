'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  CartDetails,
  CartDetailsItem,
  RenewedQuoteItem,
} from '@/modules/cart/application/ports';
import {
  cartHeading,
  displayedSubtotal,
  expiredBannerText,
  expiredQuoteItems,
  hasOutOfStockItem,
  OUT_OF_STOCK_MESSAGE,
  partitionCartItems,
  priceChangedItems,
  renewalMessage,
  unavailableItems,
} from '@/modules/cart/domain/cart-page';
import {
  acknowledgePriceChangesAction,
  getCartDetailsAction,
  refreshExpiredQuotePricesAction,
  removeCartDetailsItemAction,
  updateCartItemAction,
} from '@/modules/cart/ui/cart-actions';
import { CartPageNotices } from '@/modules/cart/ui/cart-page-notices';
import { ExpiredPricesModal } from '@/modules/cart/ui/expired-prices-modal';
import { CartPageItem } from '@/modules/cart/ui/cart-page-item';
import { CartPageSummary } from '@/modules/cart/ui/cart-page-summary';
import { cartCountStore } from '@/modules/cart/ui/cart-store';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { Button } from '@/shared/ui/button';

type Contents =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly cart: CartDetails | null };

type Notice = 'update_failed' | 'remove_failed' | 'dismiss_failed' | 'refresh_failed' | null;

/** Page-level messages; `refresh_failed` shows inside the modal instead. */
const NOTICES = {
  update_failed: 'No pudimos actualizar tu carrito. Inténtalo de nuevo.',
  remove_failed: 'No pudimos eliminar el artículo. Inténtalo de nuevo.',
  dismiss_failed: 'No pudimos descartar el aviso. Inténtalo de nuevo.',
} as const;

/** What a change request answers: the whole updated cart, plus the renewed items of a quote refresh. */
type ChangeResult = Awaited<ReturnType<typeof removeCartDetailsItemAction>> & {
  readonly renewed?: readonly RenewedQuoteItem[];
};

/** `pendingKey` of the requests that are not about one row. */
const QUOTES_KEY = 'quotes';
const NOTICES_KEY = 'notices';

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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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

  /** Runs one change; true when the page took its answer (a rejected cart empties it). */
  async function mutate(
    key: string,
    failure: Exclude<Notice, null>,
    run: (auth: { cartId: string; signinToken: string | null }) => Promise<ChangeResult>,
  ): Promise<boolean> {
    const cartId = browserCartStorage.readCartId();
    if (!cartId) {
      setContents({ kind: 'ready', cart: null });
      return true;
    }
    const request = ++latestRequest.current;
    setPendingKey(key);
    setNotice(null);
    setStatus(null);
    try {
      const result = await run({ cartId, signinToken: browserCartStorage.readSigninToken() });
      if (request !== latestRequest.current) return false;
      if (result.status === 'failed') {
        setNotice(failure);
        return false;
      }
      const cart = result.status === 'ok' ? result.cart : null;
      // A change is newer than any count read in flight.
      cartCountStore.set(cart?.totalQuantity ?? 0);
      if (result.status === 'ok' && result.renewed) {
        setStatus(
          renewalMessage(result.renewed, result.cart.summary.grandTotal?.currency ?? 'MXN'),
        );
      }
      setContents({ kind: 'ready', cart });
      return true;
    } catch {
      if (request === latestRequest.current) setNotice(failure);
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  async function renewExpiredPrices(): Promise<void> {
    const done = await mutate(QUOTES_KEY, 'refresh_failed', (auth) =>
      refreshExpiredQuotePricesAction(auth),
    );
    if (done) setModalOpen(false);
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
  const busy = pendingKey !== null;
  const expired = expiredQuoteItems(cart.items);

  const renderItem = (item: CartDetailsItem) => (
    <CartPageItem
      key={item.uid}
      item={item}
      updating={pendingKey === item.uid}
      busy={busy}
      onQuantityChange={(target, quantity) =>
        void mutate(target.uid, 'update_failed', (auth) =>
          updateCartItemAction({ ...auth, itemUid: target.uid, quantity }),
        )
      }
      onRemove={(target) =>
        void mutate(target.uid, 'remove_failed', (auth) =>
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
        {notice && notice !== 'refresh_failed' ? (
          <p role="alert" className="text-sm text-ds-text-error">
            {NOTICES[notice]}
          </p>
        ) : null}
        {status ? (
          <p role="status" className="text-sm text-ds-text-secondary">
            {status}
          </p>
        ) : null}
      </header>
      <CartPageNotices
        priceChanges={priceChangedItems(cart.items)}
        unavailable={unavailableItems(cart.items)}
        dismissing={pendingKey === NOTICES_KEY}
        onDismiss={() =>
          void mutate(NOTICES_KEY, 'dismiss_failed', (auth) => acknowledgePriceChangesAction(auth))
        }
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {regular.length > 0 ? (
            <ItemSection title="Productos en tu carrito">{regular.map(renderItem)}</ItemSection>
          ) : null}
          {quotes.length > 0 ? (
            <ItemSection
              title="Productos en tus cotizaciones"
              banner={
                expired.length > 0 ? (
                  <ExpiredQuoteBanner
                    count={expired.length}
                    disabled={busy}
                    onRefresh={() => {
                      setNotice(null);
                      setModalOpen(true);
                    }}
                  />
                ) : null
              }
            >
              {quotes.map(renderItem)}
            </ItemSection>
          ) : null}
        </div>
        <CartPageSummary
          summary={{ ...cart.summary, subtotal: displayedSubtotal(cart.summary, cart.items) }}
          updating={busy}
        />
      </div>
      {modalOpen && expired.length > 0 ? (
        <ExpiredPricesModal
          items={expired}
          loading={pendingKey === QUOTES_KEY}
          failed={notice === 'refresh_failed'}
          onConfirm={() => void renewExpiredPrices()}
          onCancel={() => setModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ItemSection({
  title,
  banner = null,
  children,
}: {
  readonly title: string;
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border-subtle pb-3">
        <h2 className="text-lg font-semibold text-ds-text">{title}</h2>
        {banner}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

/** Legacy `ExpiredQuoteBanner`: the count and the button that opens the confirmation modal. */
function ExpiredQuoteBanner({
  count,
  disabled,
  onRefresh,
}: {
  readonly count: number;
  readonly disabled: boolean;
  onRefresh(): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-ds-text-error">
      <span>{expiredBannerText(count)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRefresh}
        className="min-h-9 rounded-pill border border-current px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus disabled:opacity-60"
      >
        Actualizar precios
      </button>
    </div>
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
