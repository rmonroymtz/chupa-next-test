import type { ReactNode } from 'react';
import type { CartSummary } from '@/modules/cart/application/ports';
import { discountTotal, orderTotal, shippingLine } from '@/modules/cart/domain/cart-page';
import type { Money } from '@/modules/product/domain/product';
import { formatPrice } from '@/modules/product/ui/format-price';
import { cx } from '@/shared/ui/class-names';

/** PWA Studio checkout: a plain anchor so the edge routes it there. */
const CHECKOUT_PATH = '/checkout';

interface CartPageSummaryProps {
  readonly summary: CartSummary;
  /** A change is in flight: the checkout waits (legacy `isUpdating`). */
  readonly updating: boolean;
}

/**
 * The `/cart` price summary (legacy `CartPage/PriceSummary` + the Chupaprecios
 * `wrapUsePriceSummary`): subtotal, discounts, taxes, shipping (the selected
 * method, else the backend estimate; zero is free), the estimated total, the
 * free-shipping message and the checkout link. Rows without data are left out.
 */
export function CartPageSummary({ summary, updating }: CartPageSummaryProps) {
  const discounts = discountTotal(summary);
  const shipping = shippingLine(summary);
  const total = orderTotal(summary);
  const taxes = sum(summary.taxes);
  const threshold = summary.freeShippingThreshold;
  const currency = summary.grandTotal?.currency ?? summary.subtotal?.currency ?? 'MXN';

  return (
    <aside
      aria-label="Resumen de compra"
      className="flex flex-col gap-4 rounded-lg border border-ds-border-subtle bg-ds-surface p-5 lg:sticky lg:top-4"
    >
      <h2 className="text-lg font-semibold text-ds-text">Resumen de compra</h2>
      <dl className="flex flex-col gap-3 text-sm text-ds-text">
        {summary.subtotal ? (
          <Row label="Subtotal" testId="summary-subtotal">
            {format(summary.subtotal)}
          </Row>
        ) : null}
        {discounts ? (
          <Row label="Descuentos aplicados" testId="summary-discounts">
            -{format(discounts)}
          </Row>
        ) : null}
        {taxes ? (
          <Row label="Impuestos" testId="summary-taxes">
            {format(taxes)}
          </Row>
        ) : null}
        {shipping ? (
          <Row label="Envío" testId="summary-shipping">
            {shipping.amount > 0 ? format(shipping) : 'Gratis'}
          </Row>
        ) : null}
        {total ? (
          <Row label="Total estimado" testId="summary-total" strong>
            {format(total)}
          </Row>
        ) : null}
      </dl>
      {threshold ? (
        <p className="text-sm text-ds-text-secondary">
          Tu envío es gratuito en compras mayores a {formatPrice(threshold, currency)}
        </p>
      ) : null}
      <a
        {...(updating ? { 'aria-disabled': true } : { href: CHECKOUT_PATH })}
        role="link"
        className={cx(
          'grid min-h-11 place-items-center rounded-pill bg-ds-cta px-6 text-center font-semibold text-ds-text-on-cta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus',
          updating && 'cursor-default opacity-60',
        )}
      >
        Proceder al pago
      </a>
    </aside>
  );
}

function Row({
  label,
  testId,
  strong = false,
  children,
}: {
  readonly label: string;
  readonly testId: string;
  readonly strong?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={cx('flex items-baseline justify-between gap-4', strong && 'text-base font-bold')}
    >
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}

const format = (money: Money): string => formatPrice(money.amount, money.currency);

function sum(amounts: readonly Money[]): Money | null {
  const first = amounts[0];
  if (!first) return null;
  const amount = amounts.reduce((total, money) => total + money.amount, 0);
  return amount > 0 ? { amount, currency: first.currency } : null;
}
