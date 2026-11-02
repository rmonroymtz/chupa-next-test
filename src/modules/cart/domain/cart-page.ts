import type {
  CartDetailsItem,
  CartSummary,
  RenewedQuoteItem,
} from '@/modules/cart/application/ports';
import type { Money } from '@/modules/product/domain/product';
import { formatPrice } from '@/shared/ui/price';

/** Legacy `CartPage` heading: quote items change it (`is_from_quote`). */
export function cartHeading(items: readonly CartDetailsItem[]): string {
  return items.some((item) => item.isFromQuote) ? 'Mi carrito + cotización' : 'Mi carrito';
}

/**
 * Legacy `ProductListing`: regular items first, quote items in their own
 * section. A regular item the backend flags out of stock is left out of the
 * list: it only appears in the unavailable notice.
 */
export function partitionCartItems(items: readonly CartDetailsItem[]): {
  readonly regular: readonly CartDetailsItem[];
  readonly quotes: readonly CartDetailsItem[];
} {
  return {
    regular: items.filter((item) => !item.isFromQuote && !item.priceChange?.outOfStock),
    quotes: items.filter((item) => item.isFromQuote),
  };
}

/** Legacy `StockStatusMessage`: one out-of-stock item blocks the checkout. */
export function hasOutOfStockItem(items: readonly CartDetailsItem[]): boolean {
  return items.some((item) => item.outOfStock);
}

export const OUT_OF_STOCK_MESSAGE =
  'Un artículo en tu carrito está agotado actualmente y debe eliminarse para proceder al pago.';

/** Shipping row: the selected method, else the estimate. A zero amount is shown as free. */
export function shippingLine(summary: CartSummary): Money | null {
  return summary.selectedShipping ?? summary.shippingEstimate;
}

/**
 * Total as the legacy wrapper (`wrapUsePriceSummary`) shows it: Magento's
 * `grand_total` leaves shipping out until a method is selected, so the estimate
 * is added on top in that case.
 */
export function orderTotal(summary: CartSummary): Money | null {
  const { grandTotal } = summary;
  if (!grandTotal) return null;
  if (summary.selectedShipping || !summary.shippingEstimate) return grandTotal;
  return {
    amount: grandTotal.amount + summary.shippingEstimate.amount,
    currency: grandTotal.currency,
  };
}

/** Sum of the applied discounts; null when there are none. */
export function discountTotal(summary: CartSummary): Money | null {
  const first = summary.discounts[0];
  if (!first) return null;
  const amount = summary.discounts.reduce((sum, discount) => sum + discount.amount.amount, 0);
  return amount > 0 ? { amount, currency: first.amount.currency } : null;
}

/** Quote items whose price expired (legacy `useQuoteCartItems`). */
export function expiredQuoteItems(items: readonly CartDetailsItem[]): readonly CartDetailsItem[] {
  return items.filter((item) => item.isFromQuote && item.quotePriceExpired);
}

/** Regular items whose price changed (legacy `useCartPriceChanges`). */
export function priceChangedItems(items: readonly CartDetailsItem[]): readonly CartDetailsItem[] {
  return items.filter(
    (item) =>
      !item.isFromQuote && item.priceChange?.changed && item.priceChange.previousPrice !== null,
  );
}

/** Items the unavailable notice lists: regular items flagged by the backend and quote items out of stock. */
export function unavailableItems(items: readonly CartDetailsItem[]): readonly CartDetailsItem[] {
  return items.filter((item) =>
    item.isFromQuote ? item.outOfStock : item.priceChange?.outOfStock === true,
  );
}

/**
 * Legacy summary: the hidden out-of-stock items leave the displayed subtotal
 * (the total is Magento's and is not adjusted, as in the PWA).
 */
export function displayedSubtotal(
  summary: CartSummary,
  items: readonly CartDetailsItem[],
): Money | null {
  const { subtotal } = summary;
  if (!subtotal) return null;
  const hidden = items
    .filter((item) => !item.isFromQuote && item.priceChange?.outOfStock)
    .reduce((sum, item) => sum + (item.rowTotal?.amount ?? 0), 0);
  return hidden > 0 ? { ...subtotal, amount: Math.max(0, subtotal.amount - hidden) } : subtotal;
}

/** Legacy `ExpiredQuoteBanner` text. */
export function expiredBannerText(count: number): string {
  return count === 1
    ? 'Tienes 1 producto con precio de cotización expirado.'
    : `Tienes ${count} productos con precios de cotización expirados.`;
}

/** Legacy toast after refreshing the expired quote prices. */
export function renewalMessage(renewed: readonly RenewedQuoteItem[], currency: string): string {
  const [only] = renewed;
  if (!only) return 'No se encontraron precios por actualizar.';
  if (renewed.length > 1) return `${renewed.length} precios de cotización actualizados.`;
  if (only.previousPrice === null || only.newPrice === null) {
    return `Precio actualizado: ${only.name}`;
  }
  return `Precio actualizado: ${only.name} (${formatPrice(only.previousPrice, currency)} → ${formatPrice(only.newPrice, currency)})`;
}
