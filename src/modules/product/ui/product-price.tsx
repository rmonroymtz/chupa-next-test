import { formatPrice } from '@/modules/product/ui/format-price';

interface ProductPriceProps {
  readonly amount: number;
  readonly currency: string;
  /** Previous price; shown struck through when higher than the current one. */
  readonly previous?: number | null;
}

/**
 * Product page price, exactly as returned by the source; never converted or
 * recomputed. Product cards use the shared `Price` (`@/shared/ui/price`).
 */
export function ProductPrice({ amount, currency, previous }: ProductPriceProps) {
  const showPrevious = typeof previous === 'number' && previous > amount;
  return (
    <p className="flex items-baseline gap-3" data-testid="product-price">
      <span className="text-3xl font-bold text-ds-neutral-950">
        {formatPrice(amount, currency)}
      </span>
      {showPrevious ? (
        <s className="text-base text-ds-text-secondary">
          <span className="sr-only">Antes: </span>
          {formatPrice(previous, currency)}
        </s>
      ) : null}
    </p>
  );
}
