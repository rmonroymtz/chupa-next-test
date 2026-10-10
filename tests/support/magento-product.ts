import type { MagentoProduct } from '@/modules/product/domain/product';

const MEDIA = 'https://chupaprecios.com.mx/media/catalog/product';

/** A complete in-stock Magento product for unit tests; override what a case needs. */
export function buildMagentoProduct(overrides: Partial<MagentoProduct> = {}): MagentoProduct {
  return {
    uid: 'NzY2',
    typename: 'SimpleProduct',
    sku: 'B0TESTSKU1',
    name: 'Audífonos inalámbricos',
    urlKey: 'amazon-B0TESTSKU1-audifonos-inalambricos',
    relativeUrl: 'amazon-B0TESTSKU1-audifonos-inalambricos.html',
    descriptionHtml: '<p>Audífonos con <b>cancelación</b> de ruido.</p>',
    shortDescriptionHtml: '<p>Hasta 30 horas de batería.</p>',
    metaTitle: null,
    metaDescription: null,
    images: [
      { url: `${MEDIA}/a.jpg`, label: 'Vista frontal' },
      { url: `${MEDIA}/b.jpg`, label: null },
    ],
    price: {
      final: { amount: 1299.5, currency: 'MXN' },
      regular: { amount: 1299.5, currency: 'MXN' },
      discount: null,
    },
    availability: 'in_stock',
    categories: [],
    deliveryTo: true,
    productStatus: null,
    brand: null,
    configurableOptions: [],
    variants: [],
    related: [],
    ...overrides,
  };
}
