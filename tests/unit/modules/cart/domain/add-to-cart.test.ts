import { describe, expect, it } from 'vitest';
import {
  buildAddToCartDataLayerEvent,
  buildCartItem,
  clampQuantity,
  evaluatePurchase,
  extractVendor,
  purchasableFromMagento,
  purchasableFromScraped,
  quantityCap,
} from '@/modules/cart/domain/add-to-cart';
import type { MagentoProduct, ScrapedProduct } from '@/modules/product/domain/product';
import { buildMagentoProduct } from '../../../../support/magento-product';

const mxn = (amount: number) => ({ amount, currency: 'MXN' });

function scraped(overrides: Partial<ScrapedProduct> = {}): ScrapedProduct {
  return {
    sku: 'B0ASIN0001',
    parentSku: null,
    vendor: 'amazon',
    title: 'Lámpara',
    brand: null,
    descriptionHtml: '',
    shortDescription: '',
    images: [],
    price: { current: 450, currency: 'MXN', before: null },
    stock: null,
    availability: 'out_of_stock',
    itemAvailable: false,
    hasVariants: false,
    deliveryTo: true,
    condition: null,
    breadcrumbs: [],
    categories: [],
    ...overrides,
  };
}

function configurable(overrides: Partial<MagentoProduct> = {}): MagentoProduct {
  return buildMagentoProduct({
    typename: 'ConfigurableProduct',
    sku: 'PARENT-1',
    configurableOptions: [
      {
        uid: 'opt-size',
        attributeCode: 'size',
        label: 'Talla',
        values: [
          { uid: 'size-s', label: 'S', valueIndex: 1 },
          { uid: 'size-m', label: 'M', valueIndex: 2 },
        ],
      },
      {
        uid: 'opt-color',
        attributeCode: 'color',
        label: 'Color',
        values: [
          { uid: 'color-red', label: 'Rojo', valueIndex: 10 },
          { uid: null, label: 'Azul', valueIndex: 11 },
        ],
      },
    ],
    variants: [
      {
        uid: 'v1',
        sku: 'CHILD-S-RED',
        name: null,
        availability: 'in_stock',
        price: { final: mxn(199), regular: mxn(249) },
        attributes: [
          { code: 'size', label: 'S', valueIndex: 1 },
          { code: 'color', label: 'Rojo', valueIndex: 10 },
        ],
      },
      {
        uid: 'v2',
        sku: 'CHILD-M-RED',
        name: null,
        availability: 'out_of_stock',
        price: null,
        attributes: [
          { code: 'size', label: 'M', valueIndex: 2 },
          { code: 'color', label: 'Rojo', valueIndex: 10 },
        ],
      },
      {
        uid: 'v3',
        sku: 'CHILD-S-BLUE',
        name: null,
        availability: 'unknown',
        price: null,
        attributes: [
          { code: 'size', label: 'S', valueIndex: 1 },
          { code: 'color', label: 'Azul', valueIndex: 11 },
        ],
      },
    ],
    ...overrides,
  });
}

describe('extractVendor (legacy getVendor)', () => {
  it('takes the first dash-separated segment of the pathname without the leading slash', () => {
    expect(extractVendor('/amazon-B0TEST-lamp.html')).toBe('amazon');
    expect(extractVendor('/ebay-126981644035-shirt.html')).toBe('ebay');
  });

  it('keeps the legacy quirks: no lowercasing, no dash means the whole path', () => {
    expect(extractVendor('/Amazon-B0TEST-lamp.html')).toBe('Amazon');
    expect(extractVendor('/about.html')).toBe('about.html');
    expect(extractVendor('')).toBe('');
  });
});

describe('quantityCap / clampQuantity', () => {
  it('caps only with a finite stock of at least one', () => {
    expect(quantityCap(5)).toBe(5);
    expect(quantityCap(1)).toBe(1);
    expect(quantityCap(0)).toBeNull();
    expect(quantityCap(-3)).toBeNull();
    expect(quantityCap(null)).toBeNull();
    expect(quantityCap(Number.NaN)).toBeNull();
    expect(quantityCap(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('keeps the quantity an integer between 1 and the cap', () => {
    expect(clampQuantity(3, null)).toBe(3);
    expect(clampQuantity(0, null)).toBe(1);
    expect(clampQuantity(-2, 5)).toBe(1);
    expect(clampQuantity(9, 5)).toBe(5);
    expect(clampQuantity(2.7, null)).toBe(2);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
  });
});

describe('purchasableFromMagento / purchasableFromScraped', () => {
  it('uses the Magento sku, no stock cap, and the product availability', () => {
    const product = purchasableFromMagento(buildMagentoProduct({ availability: 'out_of_stock' }));
    expect(product).toMatchObject({
      sku: 'B0TESTSKU1',
      name: 'Audífonos inalámbricos',
      configurable: false,
      availability: 'out_of_stock',
      stockCap: null,
      price: mxn(1299.5),
    });
  });

  it('uses the scraper asin as sku and its stock as cap, and is always in stock like legacy', () => {
    const product = purchasableFromScraped(scraped({ stock: 3 }));
    expect(product).toMatchObject({
      sku: 'B0ASIN0001',
      name: 'Lámpara',
      configurable: false,
      availability: 'in_stock',
      stockCap: 3,
      price: mxn(450),
    });
  });

  it('defaults the scraped currency to MXN and keeps a null price', () => {
    expect(
      purchasableFromScraped(scraped({ price: { current: 10, currency: null, before: null } }))
        .price,
    ).toEqual(mxn(10));
    expect(purchasableFromScraped(scraped({ price: null })).price).toBeNull();
  });
});

describe('evaluatePurchase', () => {
  it('allows a simple in-stock product', () => {
    const result = evaluatePurchase(purchasableFromMagento(buildMagentoProduct()), {});
    expect(result).toEqual({ blocked: null, selectedOptionUids: [], unitPrice: mxn(1299.5) });
  });

  it('blocks a simple product Magento reports out of stock (unknown stays purchasable)', () => {
    const out = purchasableFromMagento(buildMagentoProduct({ availability: 'out_of_stock' }));
    expect(evaluatePurchase(out, {}).blocked).toBe('out_of_stock');
    const unknown = purchasableFromMagento(buildMagentoProduct({ availability: 'unknown' }));
    expect(evaluatePurchase(unknown, {}).blocked).toBeNull();
  });

  it('never blocks a scraped product on stock (legacy forces IN_STOCK)', () => {
    expect(evaluatePurchase(purchasableFromScraped(scraped()), {}).blocked).toBeNull();
  });

  it('requires every configurable option to be selected', () => {
    const product = purchasableFromMagento(configurable());
    expect(evaluatePurchase(product, {}).blocked).toBe('missing_options');
    expect(evaluatePurchase(product, { size: 1 }).blocked).toBe('missing_options');
  });

  it('blocks a selected variant that is out of stock or has no stock status', () => {
    const product = purchasableFromMagento(configurable());
    expect(evaluatePurchase(product, { size: 2, color: 10 }).blocked).toBe('out_of_stock');
    expect(evaluatePurchase(product, { size: 1, color: 11 }).blocked).toBe('out_of_stock');
  });

  it('blocks when no variant at all is in stock', () => {
    const product = purchasableFromMagento(
      configurable({
        variants: configurable().variants.map((variant) => ({
          ...variant,
          availability: 'out_of_stock' as const,
        })),
      }),
    );
    expect(evaluatePurchase(product, {}).blocked).toBe('all_out_of_stock');
  });

  it('returns selected option uids in option order and the variant final price', () => {
    const product = purchasableFromMagento(configurable());
    expect(evaluatePurchase(product, { color: 10, size: 1 })).toEqual({
      blocked: null,
      selectedOptionUids: ['size-s', 'color-red'],
      unitPrice: mxn(199),
    });
  });

  it('skips option values without uid, like legacy selectedOptionsArray', () => {
    const product = purchasableFromMagento(
      configurable({
        variants: [
          {
            uid: 'v3',
            sku: 'CHILD-S-BLUE',
            name: null,
            availability: 'in_stock',
            price: null,
            attributes: [
              { code: 'size', label: 'S', valueIndex: 1 },
              { code: 'color', label: 'Azul', valueIndex: 11 },
            ],
          },
        ],
      }),
    );
    const result = evaluatePurchase(product, { size: 1, color: 11 });
    expect(result.blocked).toBeNull();
    expect(result.selectedOptionUids).toEqual(['size-s']);
    expect(result.unitPrice).toEqual(mxn(1299.5));
  });
});

describe('buildCartItem', () => {
  it('sends sku, quantity and vendor, like the legacy CartItemInput', () => {
    const product = purchasableFromScraped(scraped());
    expect(
      buildCartItem({ product, quantity: 2, vendor: 'amazon', selectedOptionUids: [] }),
    ).toEqual({ sku: 'B0ASIN0001', quantity: 2, vendor: 'amazon' });
  });

  it('adds selected_options only when options were selected', () => {
    const product = purchasableFromMagento(configurable());
    expect(
      buildCartItem({
        product,
        quantity: 1,
        vendor: 'amazon',
        selectedOptionUids: ['size-s', 'color-red'],
      }),
    ).toEqual({
      sku: 'PARENT-1',
      quantity: 1,
      vendor: 'amazon',
      selected_options: ['size-s', 'color-red'],
    });
  });
});

describe('buildAddToCartDataLayerEvent (legacy GTM add_to_cart)', () => {
  it('builds the GA4 add_to_cart payload the legacy handler pushes', () => {
    const product = purchasableFromMagento(buildMagentoProduct());
    expect(buildAddToCartDataLayerEvent(product, mxn(1299.5), 2)).toEqual({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'MXN',
        value: 2599,
        items: [
          {
            item_id: 'B0TESTSKU1',
            item_name: 'Audífonos inalámbricos',
            price: 1299.5,
            quantity: 2,
          },
        ],
      },
    });
  });

  it('omits the event when there is no price', () => {
    const product = purchasableFromScraped(scraped({ price: null }));
    expect(buildAddToCartDataLayerEvent(product, null, 1)).toBeNull();
  });
});
