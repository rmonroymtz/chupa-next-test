import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCT_VENDORS } from '@/shared/config/env';
import { parseProductUrl } from '@/modules/product/domain/product-url';
import { buildSearchItemUrlKey, encodeSkuSegment } from '@/modules/search/domain/search-item-url';

const vendors = DEFAULT_PRODUCT_VENDORS;

describe('encodeSkuSegment', () => {
  it('keeps non-acme skus raw and collapses identical pipe parts', () => {
    expect(encodeSkuSegment('B00IJ0ALYS', 'amazon')).toBe('B00IJ0ALYS');
    expect(encodeSkuSegment('5058O035|5058O035', 'ebay')).toBe('5058O035');
    expect(encodeSkuSegment('126981644035|428130345038', 'ebay')).toBe('126981644035|428130345038');
  });

  it('encodes acme skus as unpadded base64url, like the legacy storefront', () => {
    expect(encodeSkuSegment('ab?', 'acme')).toBe('YWI_');
    expect(encodeSkuSegment('A1', 'acme')).toBe('QTE');
  });
});

describe('buildSearchItemUrlKey', () => {
  it('builds the legacy url key `{vendor}-{sku}-{slug}` from the raw title', () => {
    expect(
      buildSearchItemUrlKey('amazon', 'B00IJ0ALYS', 'DEWALT Kit de combo de perforación 20V'),
    ).toBe('amazon-B00IJ0ALYS-dewalt-kit-de-combo-de-perforaci-n-20v');
  });

  it('round-trips through the product URL parser for every vendor', () => {
    const cases = [
      ['amazon', 'B0CC1RHJY1'],
      ['ebay', '355928863885'],
      ['ebay', '126981644035|428130345038'],
      ['target', '91234567'],
      ['acme', 'SKU 01/ñ'],
    ] as const;
    for (const [vendor, sku] of cases) {
      const urlKey = buildSearchItemUrlKey(vendor, sku, 'Some Title');
      expect(parseProductUrl(`/${urlKey}.html`, { vendors })).toMatchObject({ vendor, sku });
    }
  });

  it('documents a known limitation shared with the legacy: an acme segment containing "-"', () => {
    // '~~~' is base64 'fn5+', base64url 'fn5-'. Product urls are split on '-'
    // (legacy and `parseProductUrl`), so the sku segment is cut to 'fn5' and
    // reads back as '~~' — a different sku. The url format is kept as is;
    // the fix belongs to the product url format, not to search.
    expect(encodeSkuSegment('~~~', 'acme')).toBe('fn5-');
    const urlKey = buildSearchItemUrlKey('acme', '~~~', 'Some Title');

    expect(urlKey).toBe('acme-fn5--some-title');
    expect(parseProductUrl(`/${urlKey}.html`, { vendors })).toMatchObject({
      vendor: 'acme',
      sku: '~~',
    });
  });
});
