import { formatPrice } from '@/modules/product/ui/format-price';

interface ProductPriceProps {
  readonly amount: number;
  readonly currency: string;
  /** Previous price; shown struck through when higher than the current one. */
  readonly previous?: number | null;
  /** `lg` on product pages, `sm` on product cards. */
  readonly size?: 'lg' | 'sm' | undefined;
}

/** Price exactly as returned by the source; never converted or recomputed. */
export function ProductPrice({ amount, currency, previous, size = 'lg' }: ProductPriceProps) {
  const showPrevious = typeof previous === 'number' && previous > amount;
  return (
    <p className="flex items-baseline gap-3" data-testid="product-price">
      <span className={`${size === 'lg' ? 'text-3xl' : 'text-base'} font-bold text-ds-neutral-950`}>
        {formatPrice(amount, currency)}
      </span>
      {showPrevious ? (
        <s className={`${size === 'lg' ? 'text-base' : 'text-sm'} text-ds-text-secondary`}>
          <span className="sr-only">Antes: </span>
          {formatPrice(previous, currency)}
        </s>
      ) : null}
    </p>
  );
}
