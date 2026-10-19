import { cx } from './class-names';

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats an amount exactly as returned by the source (no conversion or
 * rounding beyond the currency's minor units), with es-MX conventions.
 */
export function formatPrice(amount: number, currency: string): string {
  try {
    let formatter = formatters.get(currency);
    if (!formatter) {
      formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency });
      formatters.set(currency, formatter);
    }
    return formatter.format(amount);
  } catch {
    // Invalid ISO code (or malformed runtime value) from the source: still show
    // the amount, never break the page.
    return fallbackPrice(amount, currency);
  }
}

function fallbackPrice(amount: unknown, currency: unknown): string {
  const value =
    typeof amount === 'number' ? amount : Number(typeof amount === 'string' ? amount : NaN);
  const code = typeof currency === 'string' ? currency : '';
  return `${Number.isFinite(value) ? value.toFixed(2) : ''} ${code}`.trim();
}

/**
 * `card`: the live PWA Gallery item price (category, search, Page Builder
 * products, related products). `slider`: the PWA recommendation slider card.
 */
export type PriceVariant = 'card' | 'slider';

interface PriceProps {
  readonly amount: number;
  readonly currency: string;
  /** Previous price; shown struck through only when higher than `amount`. */
  readonly compareAt?: number | null | undefined;
  readonly variant?: PriceVariant;
}

/**
 * Product card price as the live PWA renders it: the offer price in the brand
 * anchor red (#D84752) and, only with a discount, the previous price struck
 * through. Amounts are shown exactly as returned by the source.
 */
export function Price({ amount, currency, compareAt, variant = 'card' }: PriceProps) {
  const hasCompareAt = typeof compareAt === 'number' && compareAt > amount;
  const offer = formatPrice(amount, currency);
  const previous = hasCompareAt ? formatPrice(compareAt, currency) : null;

  if (variant === 'slider') {
    // RandomSliders/ProductCard `.priceRow`, `.currentPrice`, `.oldPrice`.
    return (
      <div data-slot="price" className="mt-auto flex flex-wrap items-baseline gap-[6px]">
        <span data-price="offer" className="text-[15px] font-medium text-ds-accent">
          {offer}
        </span>
        {previous ? (
          <>
            <span className="sr-only">Antes:</span>
            {/* #888: legacy slider grey, no identical DS token. */}
            <s data-price="compare-at" className="text-[11px] text-[#888] line-through">
              {previous}
            </s>
          </>
        ) : null}
      </div>
    );
  }

  // Gallery/item.module.css `.cardDesktopPrice`, `.currentPrice`, `.oldPrice`.
  return (
    <div data-slot="price" className="block text-justify text-lg font-bold text-ds-accent">
      <div data-price="offer" className="flex min-h-[28px] items-start justify-center">
        {offer}
      </div>
      {previous ? (
        <>
          <span className="sr-only">Antes:</span>
          {/* The PWA renders the "$" at text-xs, top aligned: `::first-letter` keeps the
              amount as one text node. */}
          <s
            data-price="compare-at"
            className={cx(
              'block min-h-[20px] text-center text-sm font-light text-ds-text-tertiary line-through',
              'first-letter:align-top first-letter:text-xs',
            )}
          >
            {previous}
          </s>
        </>
      ) : null}
    </div>
  );
}
