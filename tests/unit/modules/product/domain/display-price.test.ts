import { describe, expect, it } from 'vitest';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import { buildMagentoProduct } from '../../../../support/magento-product';

const mxn = (amount: number) => ({ amount, currency: 'MXN' });

describe('getDisplayPrice', () => {
  it('shows the final price without a previous price when there is no discount', () => {
    const product = buildMagentoProduct({
      price: { final: mxn(1145.13), regular: mxn(1145.13), discount: null },
    });
    expect(getDisplayPrice(product)).toEqual({ amount: 1145.13, currency: 'MXN', previous: null });
  });

  it('shows the final (discounted) price and keeps the regular price as previous', () => {
    const product = buildMagentoProduct({
      price: {
        final: mxn(899),
        regular: mxn(1299),
        discount: { amountOff: 400, percentOff: 30.79 },
      },
    });
    expect(getDisplayPrice(product)).toEqual({ amount: 899, currency: 'MXN', previous: 1299 });
  });

  it('never shows a previous price lower than the final price or in another currency', () => {
    expect(
      getDisplayPrice(
        buildMagentoProduct({ price: { final: mxn(500), regular: mxn(400), discount: null } }),
      )?.previous,
    ).toBeNull();
    expect(
      getDisplayPrice(
        buildMagentoProduct({
          price: { final: mxn(500), regular: { amount: 40, currency: 'USD' }, discount: null },
        }),
      )?.previous,
    ).toBeNull();
  });

  it('returns null when Magento sent no price', () => {
    expect(getDisplayPrice(buildMagentoProduct({ price: null }))).toBeNull();
  });
});
