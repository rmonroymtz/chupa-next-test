import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type { MagentoProduct } from '@/modules/product/domain/product';
import { ProductPrice } from '@/modules/product/ui/product-price';

interface MagentoProductPriceProps {
  readonly product: Pick<MagentoProduct, 'price'>;
}

/** Visible price of a Magento product; same value as its JSON-LD offer. */
export function MagentoProductPrice({ product }: MagentoProductPriceProps) {
  const price = getDisplayPrice(product);
  if (!price) return null;
  return <ProductPrice amount={price.amount} currency={price.currency} previous={price.previous} />;
}
