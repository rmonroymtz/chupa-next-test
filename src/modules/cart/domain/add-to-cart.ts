/**
 * Add-to-cart rules replicated from the legacy PWA Studio PDP
 * (`src/overrides/@magento/peregrine/lib/talons/ProductFullDetail/useProductFullDetail.js`).
 * No rule here validates prices: Magento decides what can be added and
 * answers with `user_errors`, which the UI shows as is.
 *
 * Pure domain code: no framework imports and no I/O.
 */
import type { ProductAddedToCart } from '@/modules/analytics/domain/analytics-event';
import type {
  Availability,
  MagentoProduct,
  Money,
  ScrapedProduct,
} from '@/modules/product/domain/product';

/** Prices from the scraper API come in MXN unless it says otherwise. */
const DEFAULT_SCRAPED_CURRENCY = 'MXN';
const CONFIGURABLE_TYPENAME = 'ConfigurableProduct';

export interface PurchasableOption {
  readonly attributeCode: string;
  readonly label: string;
  readonly values: readonly {
    readonly uid: string | null;
    readonly label: string;
    readonly valueIndex: number;
  }[];
}

export interface PurchasableVariant {
  readonly attributes: readonly { readonly code: string; readonly valueIndex: number }[];
  readonly availability: Availability;
  readonly finalPrice: Money | null;
}

/** Serializable product data the add-to-cart control needs (server → client). */
export interface PurchasableProduct {
  /** Magento sku, or the scraper `asin` for products Magento does not have yet. */
  readonly sku: string;
  readonly name: string;
  readonly configurable: boolean;
  readonly availability: Availability;
  readonly options: readonly PurchasableOption[];
  readonly variants: readonly PurchasableVariant[];
  /** Final price, for analytics only. */
  readonly price: Money | null;
  /** Maximum quantity (scraper stock); null means no cap. */
  readonly stockCap: number | null;
}

/** Selected `value_index` per attribute code. */
export type OptionSelections = Readonly<Record<string, number | undefined>>;

export type PurchaseBlock = 'missing_options' | 'out_of_stock' | 'all_out_of_stock';

export interface PurchaseEvaluation {
  /** Why the button is disabled; null when the product can be added. */
  readonly blocked: PurchaseBlock | null;
  /** `selected_options` uids, in option order. */
  readonly selectedOptionUids: readonly string[];
  readonly unitPrice: Money | null;
}

/** `CartItemInput` sent to `addProductsToCart`. */
export interface CartItemPayload {
  readonly sku: string;
  readonly quantity: number;
  readonly vendor: string;
  readonly selected_options?: readonly string[];
}

/** Legacy `getVendor`: first `-` segment of the pathname without its first character. */
export function extractVendor(pathname: string): string {
  return (pathname.split('-')[0] ?? '').substring(1);
}

/** Legacy `maxQuantity`: the scraper stock caps the quantity only when it is a finite number ≥ 1. */
export function quantityCap(stock: number | null | undefined): number | null {
  return typeof stock === 'number' && Number.isFinite(stock) && stock >= 1
    ? Math.floor(stock)
    : null;
}

/** Quantity stepper bounds: an integer, at least 1 and at most the cap. */
export function clampQuantity(quantity: number, cap: number | null): number {
  const whole = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  const atLeastOne = Math.max(1, whole);
  return cap === null ? atLeastOne : Math.min(atLeastOne, cap);
}

export function purchasableFromMagento(product: MagentoProduct): PurchasableProduct {
  return {
    sku: product.sku,
    name: product.name,
    configurable: product.typename === CONFIGURABLE_TYPENAME,
    availability: product.availability,
    options: product.configurableOptions.map((option) => ({
      attributeCode: option.attributeCode,
      label: option.label,
      values: option.values.map(({ uid, label, valueIndex }) => ({ uid, label, valueIndex })),
    })),
    variants: product.variants.map((variant) => ({
      attributes: variant.attributes.map(({ code, valueIndex }) => ({ code, valueIndex })),
      availability: variant.availability,
      finalPrice: variant.price?.final ?? null,
    })),
    price: product.price?.final ?? null,
    // Legacy reads `product.stock`, which Magento products do not have: no cap.
    stockCap: null,
  };
}

/**
 * Legacy `getProductSearchObject` always sets `stock_status: 'IN_STOCK'` for
 * scraped products, so they are never blocked on stock; their stock only caps
 * the quantity.
 */
export function purchasableFromScraped(product: ScrapedProduct): PurchasableProduct {
  return {
    sku: product.sku,
    name: product.title,
    configurable: false,
    availability: 'in_stock',
    options: [],
    variants: [],
    price: product.price
      ? {
          amount: product.price.current,
          currency: product.price.currency ?? DEFAULT_SCRAPED_CURRENCY,
        }
      : null,
    stockCap: quantityCap(product.stock),
  };
}

/** Legacy `isOutOfStock`, `isEverythingOutOfStock` and `isMissingOptions`. */
export function evaluatePurchase(
  product: PurchasableProduct,
  selections: OptionSelections,
): PurchaseEvaluation {
  const selected = product.options.flatMap((option) => {
    const valueIndex = selections[option.attributeCode];
    return valueIndex === undefined ? [] : [{ option, valueIndex }];
  });
  const selectedOptionUids = selected.flatMap(
    ({ option, valueIndex }) =>
      option.values.find((value) => value.valueIndex === valueIndex)?.uid ?? [],
  );
  const variant =
    product.configurable && selected.length > 0
      ? product.variants.find((candidate) =>
          selected.every(({ option, valueIndex }) =>
            candidate.attributes.some(
              (attribute) =>
                attribute.code === option.attributeCode && attribute.valueIndex === valueIndex,
            ),
          ),
        )
      : undefined;
  const complete = selected.length === product.options.length;
  const unitPrice = (complete ? variant?.finalPrice : null) ?? product.price;

  return {
    blocked: blockReason(product, selected.length, variant),
    selectedOptionUids,
    unitPrice,
  };
}

function blockReason(
  product: PurchasableProduct,
  selectedCount: number,
  variant: PurchasableVariant | undefined,
): PurchaseBlock | null {
  if (!product.configurable) {
    return product.availability === 'out_of_stock' ? 'out_of_stock' : null;
  }
  if (!product.variants.some((candidate) => candidate.availability === 'in_stock')) {
    return 'all_out_of_stock';
  }
  // A selection with no matching variant, or one without stock status, is out of stock.
  if (selectedCount > 0 && variant?.availability !== 'in_stock') return 'out_of_stock';
  if (selectedCount < product.options.length) return 'missing_options';
  return null;
}

export function buildCartItem(input: {
  readonly product: PurchasableProduct;
  readonly quantity: number;
  readonly vendor: string;
  readonly selectedOptionUids: readonly string[];
}): CartItemPayload {
  const item = { sku: input.product.sku, quantity: input.quantity, vendor: input.vendor };
  return input.selectedOptionUids.length > 0
    ? { ...item, selected_options: [...input.selectedOptionUids] }
    : item;
}

/**
 * The analytics event for a successful add (legacy `CART_ADD_ITEM`); the GTM
 * provider maps it to the GA4 `add_to_cart` payload. Null without a price:
 * the legacy payload would carry no currency and a NaN value.
 */
export function buildProductAddedToCartEvent(
  product: PurchasableProduct,
  unitPrice: Money | null,
  quantity: number,
): ProductAddedToCart | null {
  if (!unitPrice) return null;
  return {
    type: 'ProductAddedToCart',
    sku: product.sku,
    name: product.name,
    unitPrice: { amount: unitPrice.amount, currency: unitPrice.currency },
    quantity,
  };
}
