import type { MagentoProduct } from '@/modules/product/domain/product';

/** The single price shown to shoppers and declared in structured data. */
export interface DisplayPrice {
  /** Price to pay: Magento's final price, exactly as returned. */
  readonly amount: number;
  readonly currency: string;
  /** Regular price shown struck through; only when higher, in the same currency. */
  readonly previous: number | null;
}

/**
 * Source of truth for every price a product page declares. The visible price
 * and the JSON-LD offer both read it, so they can never disagree.
 */
export function getDisplayPrice(product: Pick<MagentoProduct, 'price'>): DisplayPrice | null {
  const { price } = product;
  if (!price) return null;
  const { final, regular } = price;
  const discounted = regular.currency === final.currency && regular.amount > final.amount;
  return {
    amount: final.amount,
    currency: final.currency,
    previous: discounted ? regular.amount : null,
  };
}
