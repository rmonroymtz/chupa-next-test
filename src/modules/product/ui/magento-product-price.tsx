import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type { MagentoProduct } from '@/modules/product/domain/product';
import { ProductPrice } from '@/modules/product/ui/product-price';
import { Price, type PriceVariant } from '@/shared/ui/price';

interface MagentoProductPriceProps {
  readonly product: Pick<MagentoProduct, 'price'>;
  /** `pdp` (default): the product page price; otherwise the shared card price. */
  readonly variant?: 'pdp' | PriceVariant;
}

/** Visible price of a Magento product; same value as its JSON-LD offer. */
export function MagentoProductPrice({ product, variant = 'pdp' }: MagentoProductPriceProps) {
  const price = getDisplayPrice(product);
  if (!price) return null;
  if (variant !== 'pdp') {
    return (
      <Price
        amount={price.amount}
        currency={price.currency}
        compareAt={price.previous}
        variant={variant}
      />
    );
  }
  return <ProductPrice amount={price.amount} currency={price.currency} previous={price.previous} />;
}
