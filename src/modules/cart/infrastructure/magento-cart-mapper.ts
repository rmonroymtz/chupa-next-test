import type { MiniCart, MiniCartItem } from '@/modules/cart/application/ports';
import type { Money } from '@/modules/product/domain/product';

/**
 * Magento messages peregrine treats as an unusable cart id
 * (`isInvalidCart` in `lib/store/actions/cart/asyncActions.js`).
 */
const INVALID_CART_MESSAGES = [
  'Could not find a cart',
  "The cart isn't active",
  'The current user cannot perform operations on cart',
];

export function isInvalidCartMessage(message: string): boolean {
  return INVALID_CART_MESSAGES.some((fragment) => message.includes(fragment));
}

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null;
const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function toMoney(value: unknown): Money | null {
  const money = asRecord(value);
  const amount = asNumber(money?.value);
  const currency = asString(money?.currency);
  return amount !== null && currency ? { amount, currency } : null;
}

/** Maps a `MiniCartQuery` cart; items without uid or product are skipped. */
export function mapMiniCart(raw: unknown, productUrlSuffix: string): MiniCart {
  const cart = asRecord(raw);
  const items = Array.isArray(cart?.items) ? cart.items : [];
  return {
    totalQuantity: asNumber(cart?.total_quantity) ?? 0,
    subtotal: toMoney(asRecord(cart?.prices)?.subtotal_excluding_tax),
    items: items.flatMap((item) => {
      const mapped = mapItem(item, productUrlSuffix);
      return mapped ? [mapped] : [];
    }),
  };
}

function mapItem(raw: unknown, productUrlSuffix: string): MiniCartItem | null {
  const item = asRecord(raw);
  const product = asRecord(item?.product);
  const uid = asString(item?.uid);
  if (!item || !product || !uid) return null;
  const urlKey = asString(product.url_key);
  const options = Array.isArray(item.configurable_options) ? item.configurable_options : [];
  return {
    uid,
    name: asString(product.name) ?? '',
    sku: asString(product.sku) ?? '',
    // Legacy mini cart item link: `/${url_key}${storeUrlSuffix}`.
    url: urlKey ? `/${urlKey}${productUrlSuffix}` : '/',
    thumbnailUrl: asString(asRecord(product.thumbnail)?.url),
    quantity: asNumber(item.quantity) ?? 0,
    unitPrice: toMoney(asRecord(item.prices)?.price),
    options: options.flatMap((option) => {
      const entry = asRecord(option);
      const label = asString(entry?.option_label);
      const value = asString(entry?.value_label);
      return label !== null && value !== null ? [{ label, value }] : [];
    }),
    outOfStock: product.stock_status === 'OUT_OF_STOCK',
  };
}
