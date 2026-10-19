import Image from 'next/image';
import type { MiniCartItem as MiniCartItemData } from '@/modules/cart/application/ports';
import { formatPrice } from '@/modules/product/ui/format-price';
import { cx } from '@/shared/ui/class-names';

/*
 * The arbitrary colors mirror the legacy PWA row (`MiniCart/ProductList/item.module.css`,
 * never restyled on the DS there; pwa-ch-theme grays have no identical DS token):
 * gray-800 #333F47 (name, price), gray-600 #767B7F (quantity), gray-500 #959A9D
 * (trash icon), gray-200 #EAEBEB (divider while deleting), #7E7E7E (trash border).
 */

interface MiniCartItemProps {
  readonly item: MiniCartItemData;
  /** This row is being removed (PWA `root_disabled`). */
  readonly removing: boolean;
  /** A removal is running in the panel: the other rows wait for it. */
  readonly busy: boolean;
  onRemove(item: MiniCartItemData): void;
}

/**
 * One mini-cart row exactly as the PWA `MiniCart/ProductList/item`: the
 * 80px image and the name link to the product, "Cantidad: N" with the price
 * stacked below, and a 32px trash button at the right end. No option lines
 * and no stock label (the PWA shows the panel-level stock message instead).
 */
export function MiniCartItem({ item, removing, busy, onRemove }: MiniCartItemProps) {
  return (
    <li
      aria-busy={removing || undefined}
      className={cx(
        'flex items-center justify-between',
        removing ? 'border-b border-[#eaebeb] p-4 opacity-50' : 'mb-5',
      )}
    >
      {/* Same target as the name link: out of the tab order and hidden, one link per product. */}
      <a href={item.url} tabIndex={-1} aria-hidden="true" className="shrink-0">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt=""
            width={80}
            height={80}
            unoptimized
            loading="lazy"
            className="mb-4 block size-20 rounded-[4px] object-cover"
          />
        ) : (
          <span className="mb-4 block size-20 rounded-[4px] bg-ds-surface-subtle" />
        )}
      </a>
      <div className="mx-4 min-w-0 flex-1">
        <a
          href={item.url}
          className="line-clamp-2 rounded-xs text-[14px] leading-none font-normal text-[#333f47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
        >
          {item.name}
        </a>
        <div className="mt-2 text-[12px] leading-none text-[#767b7f]">
          <span className="block">Cantidad: {item.quantity}</span>
          {item.unitPrice ? (
            <Price amount={item.unitPrice.amount} currency={item.unitPrice.currency} />
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        <button
          type="button"
          aria-label={`Eliminar ${item.name}`}
          aria-disabled={busy || undefined}
          aria-busy={removing || undefined}
          onClick={() => {
            if (!busy) onRemove(item);
          }}
          className={cx(
            'flex size-8 items-center justify-center rounded-[8px] border border-[#7e7e7e] text-[#959a9d] opacity-50 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus',
            busy && 'cursor-default',
          )}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

/** Venia `Price`: the currency symbol in its own 12px regular span, the amount bold. */
function Price({ amount, currency }: { readonly amount: number; readonly currency: string }) {
  const parts = priceParts(amount, currency);
  return (
    <span className="text-[12px] font-bold text-[#333f47]">
      {parts ? (
        <>
          <span className="text-[12px] font-normal">{parts.symbol}</span>
          {parts.amount}
        </>
      ) : (
        formatPrice(amount, currency)
      )}
    </span>
  );
}

function priceParts(
  amount: number,
  currency: string,
): { readonly symbol: string; readonly amount: string } | null {
  try {
    const parts = new Intl.NumberFormat('es-MX', { style: 'currency', currency }).formatToParts(
      amount,
    );
    const symbol = parts.find((part) => part.type === 'currency')?.value ?? '';
    const rest = parts
      .filter((part) => part.type !== 'currency' && part.type !== 'literal')
      .map((part) => part.value)
      .join('');
    return symbol ? { symbol, amount: rest } : null;
  } catch {
    return null;
  }
}

/**
 * react-feather `Trash2` (the PWA delete icon) at 16px. Inline: the DS icon
 * catalog has no trash glyph and its structural test pins the catalog size.
 */
function TrashIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
