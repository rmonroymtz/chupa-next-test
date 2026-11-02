import type { ReactNode } from 'react';
import type { CartDetailsItem } from '@/modules/cart/application/ports';
import { formatPrice } from '@/shared/ui/price';
import { cx } from '@/shared/ui/class-names';

interface CartPageNoticesProps {
  readonly priceChanges: readonly CartDetailsItem[];
  readonly unavailable: readonly CartDetailsItem[];
  readonly dismissing: boolean;
  onDismiss(): void;
}

/**
 * Legacy `CartChangesNotification`: the products whose price changed (with a
 * dismiss button) and the products that are no longer available. Both lists
 * come from the backend `cp_price_change` data, so with the backend switch
 * off nothing shows.
 */
export function CartPageNotices({
  priceChanges,
  unavailable,
  dismissing,
  onDismiss,
}: CartPageNoticesProps) {
  if (priceChanges.length === 0 && unavailable.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {priceChanges.length > 0 ? (
        <Notice title="Actualización en los productos de tu carrito">
          <p>
            {priceChanges.length === 1
              ? '1 producto de tu carrito cambió de precio para alinearse con los costos actuales de la página:'
              : `${priceChanges.length} productos de tu carrito cambiaron de precio para alinearse con los costos actuales de la página:`}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {priceChanges.map((item) => (
              <PriceChangeLine key={item.uid} item={item} />
            ))}
          </ul>
          <button
            type="button"
            disabled={dismissing}
            onClick={onDismiss}
            className="mt-3 min-h-9 rounded-pill border border-ds-border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus disabled:opacity-60"
          >
            {dismissing ? 'Descartando...' : 'Entendido'}
          </button>
        </Notice>
      ) : null}
      {unavailable.length > 0 ? (
        <Notice title="Actualización en los productos de tus cotizaciones">
          <p>
            {unavailable.length === 1
              ? '1 producto de tu carrito no está disponible:'
              : `${unavailable.length} productos de tu carrito no están disponibles:`}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {unavailable.map((item) => (
              <li key={item.uid}>{item.name}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}

function Notice({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-ds-border-subtle bg-ds-surface-subtle p-4 text-sm text-ds-text"
    >
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PriceChangeLine({ item }: { readonly item: CartDetailsItem }) {
  const change = item.priceChange;
  if (!change || change.previousPrice === null) return null;
  const currency = item.unitPrice?.currency ?? 'MXN';
  const current = change.currentPrice ?? item.unitPrice?.amount ?? change.previousPrice;
  const delta = change.delta ?? current - change.previousPrice;
  return (
    <li className={cx('font-semibold', delta > 0 ? 'text-ds-text-error' : 'text-ds-text')}>
      {`${item.name}: ${formatPrice(change.previousPrice, currency)} → ${formatPrice(current, currency)} (${delta > 0 ? '+' : '-'}${formatPrice(Math.abs(delta), currency)})`}
    </li>
  );
}
