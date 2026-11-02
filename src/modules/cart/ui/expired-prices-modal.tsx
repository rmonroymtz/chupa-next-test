'use client';

import { useEffect, useId, useRef } from 'react';
import type { CartDetailsItem } from '@/modules/cart/application/ports';
import { formatPrice } from '@/shared/ui/price';
import { Button } from '@/shared/ui/button';

interface ExpiredPricesModalProps {
  readonly items: readonly CartDetailsItem[];
  /** The renewal is running. */
  readonly loading: boolean;
  /** The last renewal failed. */
  readonly failed: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Legacy `ExpiredPricesModal`: lists the quote items with an expired price and
 * asks before renewing them at the catalog price. Escape, the backdrop and
 * "Volver al carrito" cancel. Focus starts on the safe button.
 */
export function ExpiredPricesModal({
  items,
  loading,
  failed,
  onConfirm,
  onCancel,
}: ExpiredPricesModalProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onCancel();
        }}
        className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg bg-ds-surface p-6 shadow-elevation-3"
      >
        <h2 id={titleId} className="text-lg font-bold text-ds-text">
          Precios de cotización expirados
        </h2>
        <p className="text-sm text-ds-text-secondary">
          Los siguientes productos tienen precios de cotización vencidos. Al actualizar, se
          aplicarán los precios vigentes del catálogo.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-ds-text">
          {items.map((item) => (
            <li key={item.uid} className="flex justify-between gap-4">
              <span>{item.name}</span>
              {item.unitPrice ? (
                <span className="shrink-0 font-semibold">
                  {formatPrice(item.unitPrice.amount, item.unitPrice.currency)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {failed ? (
          <p role="alert" className="text-sm text-ds-text-error">
            Error al actualizar precios de cotización. Intenta nuevamente.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-pill border border-ds-border px-5 font-semibold text-ds-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
          >
            Volver al carrito
          </button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar y continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
