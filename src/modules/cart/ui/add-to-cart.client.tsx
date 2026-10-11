'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  buildAddToCartDataLayerEvent,
  buildCartItem,
  clampQuantity,
  evaluatePurchase,
  extractVendor,
  type OptionSelections,
  type PurchasableProduct,
} from '@/modules/cart/domain/add-to-cart';
import { addToCartAction } from '@/modules/cart/ui/cart-actions';
import { cartCountStore } from '@/modules/cart/ui/cart-store';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';

// Shopper copy from the legacy PDP (`useProductFullDetail` and `es_MX.json`).
const ADDING = 'Agregando producto al carrito...';
const ADDED = '¡Producto agregado correctamente!';
const FAILED = 'Lo sentimos, no pudimos agregar este producto al carrito.';
const USER_ERROR_FALLBACK = 'Error al agregar producto al carrito.';
const OUT_OF_STOCK = 'Este artículo está agotado actualmente';
const MISSING_OPTIONS = 'Selecciona todas las opciones para agregar el producto al carrito.';
/** Legacy clears the notification after 3 s. */
const NOTICE_MS = 3000;

type Notice =
  | { readonly kind: 'none' }
  | { readonly kind: 'info' | 'success' | 'error'; readonly message: string };

interface AddToCartProps {
  readonly product: PurchasableProduct;
}

/**
 * Add-to-cart island for both PDP kinds. Reads the PWA cart id and token
 * from storage, asks the Server Action to add the item (creating or
 * recovering the cart in Magento), stores a newly created cart id in the PWA
 * format and updates the header count.
 */
export function AddToCart({ product }: AddToCartProps) {
  const id = useId();
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<OptionSelections>({});
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: 'none' });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const cap = product.stockCap;
  const evaluation = evaluatePurchase(product, selections);
  const disabled = evaluation.blocked !== null || adding;

  function show(next: Notice): void {
    clearTimeout(clearTimer.current);
    setNotice(next);
    if (next.kind === 'success' || next.kind === 'info') {
      // Errors stay until the next attempt so they can be read; legacy cleared them too.
      clearTimer.current = setTimeout(() => setNotice({ kind: 'none' }), NOTICE_MS);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled) return;
    const units = clampQuantity(quantity, cap);
    const item = buildCartItem({
      product,
      quantity: units,
      vendor: extractVendor(window.location.pathname),
      selectedOptionUids: evaluation.selectedOptionUids,
    });
    setAdding(true);
    show({ kind: 'info', message: ADDING });
    try {
      const result = await addToCartAction({
        cartId: browserCartStorage.readCartId(),
        signinToken: browserCartStorage.readSigninToken(),
        item,
      });
      if (result.newCartId) browserCartStorage.writeCartId(result.newCartId);
      if (result.status === 'failed') {
        show({ kind: 'error', message: FAILED });
        return;
      }
      cartCountStore.set(result.totalQuantity);
      if (result.userErrors.length > 0) {
        const message = result.userErrors.map((error) => error.message).join('\n');
        show({ kind: 'error', message: message || USER_ERROR_FALLBACK });
        return;
      }
      show({ kind: 'success', message: ADDED });
      pushDataLayer(buildAddToCartDataLayerEvent(product, evaluation.unitPrice, units));
    } catch {
      show({ kind: 'error', message: FAILED });
    } finally {
      setAdding(false);
    }
  }

  const blockedMessage =
    product.configurable && evaluation.blocked
      ? evaluation.blocked === 'missing_options'
        ? MISSING_OPTIONS
        : OUT_OF_STOCK
      : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="add-to-cart">
      {product.options.map((option) => (
        <fieldset key={option.attributeCode} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-neutral-black-base">
            {option.label}
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const inputId = `${id}-${option.attributeCode}-${value.valueIndex}`;
              return (
                <span key={value.valueIndex}>
                  <input
                    type="radio"
                    id={inputId}
                    name={`${id}-${option.attributeCode}`}
                    value={value.valueIndex}
                    checked={selections[option.attributeCode] === value.valueIndex}
                    onChange={() =>
                      setSelections((current) => ({
                        ...current,
                        [option.attributeCode]: value.valueIndex,
                      }))
                    }
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={inputId}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-box border border-neutral-medium-grey px-3 text-sm peer-checked:border-neutral-black peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-black"
                  >
                    {value.label}
                  </label>
                </span>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <QuantityStepper value={quantity} cap={cap} onChange={setQuantity} />
        <button
          type="submit"
          disabled={disabled}
          className="h-12 min-w-48 flex-1 rounded-button bg-brand-red px-6 font-semibold text-white hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-black disabled:cursor-not-allowed disabled:bg-neutral-medium-grey"
        >
          {adding ? 'Agregando...' : 'Agregar al carrito'}
        </button>
      </div>

      {blockedMessage ? <p className="text-sm text-neutral-black-base">{blockedMessage}</p> : null}

      {/* Live regions exist before their content changes, so updates are announced. */}
      <div>
        <p role="status" className="text-sm text-neutral-black-base">
          {notice.kind === 'info' || notice.kind === 'success' ? notice.message : ''}
        </p>
        <p
          role="alert"
          className={
            notice.kind === 'error'
              ? 'whitespace-pre-line rounded-box bg-feedback-error px-3 py-2 text-sm text-neutral-black'
              : undefined
          }
        >
          {notice.kind === 'error' ? notice.message : ''}
        </p>
      </div>
    </form>
  );
}

interface QuantityStepperProps {
  readonly value: number;
  readonly cap: number | null;
  onChange(next: number): void;
}

/** Legacy `QuantityStepper`: min 1, max the scraper stock when known. */
function QuantityStepper({ value, cap, onChange }: QuantityStepperProps) {
  const stepClass =
    'grid size-11 place-items-center rounded-full border border-neutral-medium-grey text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-black';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        className={stepClass}
        disabled={value <= 1}
        onClick={() => onChange(clampQuantity(value - 1, cap))}
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Cantidad de artículos"
        min={1}
        max={cap ?? undefined}
        step={1}
        value={value}
        onChange={(event) => onChange(clampQuantity(event.currentTarget.valueAsNumber, cap))}
        className="h-11 w-16 rounded-input border border-neutral-medium-grey text-center"
      />
      <button
        type="button"
        aria-label="Aumentar cantidad"
        className={stepClass}
        disabled={cap !== null && value >= cap}
        onClick={() => onChange(clampQuantity(value + 1, cap))}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

/** Same guard as the legacy `safePush`: only when GTM created `dataLayer`. */
function pushDataLayer(event: object | null): void {
  if (!event) return;
  try {
    const { dataLayer } = window as unknown as { dataLayer?: unknown[] };
    dataLayer?.push(event);
  } catch {
    // Analytics never breaks the purchase flow.
  }
}
