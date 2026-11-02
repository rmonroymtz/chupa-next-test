'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CartDetailsItem } from '@/modules/cart/application/ports';
import { QuoteBadge } from '@/modules/cart/ui/quote-badge';
import { formatPrice } from '@/modules/product/ui/format-price';
import { cx } from '@/shared/ui/class-names';

interface CartPageItemProps {
  readonly item: CartDetailsItem;
  /** This row has a request in flight (legacy `item_disabled`). */
  readonly updating: boolean;
  /** Some request is running: the other rows wait for it. */
  readonly busy: boolean;
  onQuantityChange(item: CartDetailsItem, quantity: number): void;
  onRemove(item: CartDetailsItem): void;
}

const BUTTON_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';

/**
 * One row of the `/cart` page (legacy `CartPage/ProductListing/product`): the
 * image and name link to the product, the variant options, the quantity
 * stepper, the unit price and the "Eliminar" button. The quantity commits on
 * the +/- buttons, Enter and blur; an invalid value is dropped.
 */
export function CartPageItem({
  item,
  updating,
  busy,
  onQuantityChange,
  onRemove,
}: CartPageItemProps) {
  return (
    <li
      aria-label={item.name}
      aria-busy={updating || undefined}
      className={cx(
        'flex flex-col gap-4 border-b border-ds-border-subtle py-5 sm:flex-row sm:items-start',
        updating && 'opacity-50',
      )}
    >
      <a href={item.url} tabIndex={-1} aria-hidden="true" className="shrink-0">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            width={120}
            height={120}
            unoptimized
            loading="lazy"
            className="block size-[120px] rounded-sm object-cover"
          />
        ) : (
          <span className="block size-[120px] rounded-sm bg-ds-surface-subtle" />
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <a
          href={item.url}
          className={cx(
            'line-clamp-2 rounded-xs text-body-md font-semibold text-ds-text hover:underline',
            BUTTON_FOCUS,
          )}
        >
          {item.name}
        </a>
        <QuoteBadge item={item} />
        {item.options.length > 0 ? (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ds-text-secondary">
            {item.options.map((option) => (
              <div key={option.label} className="flex gap-1">
                <dt>{option.label}</dt>
                <dd className="font-semibold">{option.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <QuantityStepper
            key={item.quantity}
            item={item}
            disabled={busy}
            onCommit={(quantity) => onQuantityChange(item, quantity)}
          />
          <button
            type="button"
            aria-label={`Eliminar ${item.name}`}
            disabled={busy}
            onClick={() => onRemove(item)}
            className={cx(
              'rounded-xs text-sm text-ds-text-secondary underline hover:text-ds-text disabled:cursor-default disabled:no-underline disabled:opacity-60',
              BUTTON_FOCUS,
            )}
          >
            Eliminar
          </button>
        </div>
      </div>
      <p className="shrink-0 text-lg font-bold text-ds-text sm:text-right">
        <span className="mr-2 text-sm font-normal text-ds-text-secondary sm:hidden">Precio</span>
        {item.unitPrice ? formatPrice(item.unitPrice.amount, item.unitPrice.currency) : null}
      </p>
    </li>
  );
}

interface QuantityStepperProps {
  readonly item: CartDetailsItem;
  readonly disabled: boolean;
  onCommit(quantity: number): void;
}

/** Remounted (by `key`) whenever Magento answers a new quantity, so the draft never goes stale. */
function QuantityStepper({ item, disabled, onCommit }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(item.quantity));

  function commit(): void {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1) {
      setDraft(String(item.quantity));
      return;
    }
    if (next !== item.quantity) onCommit(next);
  }

  const stepClasses = cx(
    'grid size-8 place-items-center rounded-sm border border-ds-border text-ds-text disabled:cursor-default disabled:opacity-40',
    BUTTON_FOCUS,
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ds-text-secondary">Cantidad</span>
      <button
        type="button"
        aria-label={`Disminuir cantidad de ${item.name}`}
        disabled={disabled || item.quantity <= 1}
        onClick={() => onCommit(item.quantity - 1)}
        className={stepClasses}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        aria-label={`Cantidad de ${item.name}`}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
        }}
        className={cx(
          'h-8 w-14 [appearance:textfield] rounded-sm border border-ds-border bg-ds-surface text-center text-sm text-ds-text disabled:opacity-60 [&::-webkit-inner-spin-button]:appearance-none',
          BUTTON_FOCUS,
        )}
      />
      <button
        type="button"
        aria-label={`Aumentar cantidad de ${item.name}`}
        disabled={disabled}
        onClick={() => onCommit(item.quantity + 1)}
        className={stepClasses}
      >
        +
      </button>
    </div>
  );
}
