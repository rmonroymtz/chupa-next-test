import type { CartDetailsItem } from '@/modules/cart/application/ports';
import { cx } from '@/shared/ui/class-names';

/**
 * Legacy `QuoteBadge`: "Precio de cotización" with its expiry date, or "Precio
 * expirado" once Magento flags it. Only quote items get one.
 */
export function QuoteBadge({ item }: { readonly item: CartDetailsItem }) {
  if (!item.isFromQuote) return null;
  // Magento sends `YYYY-MM-DD HH:MM:SS`; the legacy badge shows the date part.
  const validUntil = item.quoteExpiresAt?.split(' ')[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span
        className={cx(
          'rounded-pill px-2 py-0.5 font-semibold',
          item.quotePriceExpired
            ? 'bg-ds-error-bg text-ds-text-error'
            : 'bg-ds-surface-subtle text-ds-text',
        )}
      >
        {item.quotePriceExpired ? 'Precio expirado' : 'Precio de cotización'}
      </span>
      {!item.quotePriceExpired && validUntil ? (
        <span className="text-ds-text-secondary">Válido hasta: {validUntil}</span>
      ) : null}
    </div>
  );
}
