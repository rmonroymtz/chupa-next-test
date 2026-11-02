import type { CartDetailsItem } from '@/modules/cart/application/ports';

/** Legacy `CartPage` heading: quote items change it (`is_from_quote`). */
export function cartHeading(items: readonly CartDetailsItem[]): string {
  return items.some((item) => item.isFromQuote) ? 'Mi carrito + cotización' : 'Mi carrito';
}

/** Legacy `ProductListing`: regular items first, quote items in their own section. */
export function partitionCartItems(items: readonly CartDetailsItem[]): {
  readonly regular: readonly CartDetailsItem[];
  readonly quotes: readonly CartDetailsItem[];
} {
  return {
    regular: items.filter((item) => !item.isFromQuote),
    quotes: items.filter((item) => item.isFromQuote),
  };
}

/** Legacy `StockStatusMessage`: one out-of-stock item blocks the checkout. */
export function hasOutOfStockItem(items: readonly CartDetailsItem[]): boolean {
  return items.some((item) => item.outOfStock);
}

export const OUT_OF_STOCK_MESSAGE =
  'Un artículo en tu carrito está agotado actualmente y debe eliminarse para proceder al pago.';
