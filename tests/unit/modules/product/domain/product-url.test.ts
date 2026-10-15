import { describe, expect, it } from 'vitest';
import {
  buildCanonicalUrl,
  decodeSkuSegment,
  matchSkuSearchUrl,
  normalizeSku,
  parseProductUrl,
  toRouteUrl,
} from '@/modules/product/domain/product-url';

const vendors = ['amazon', 'ebay', 'target', 'acme'] as const;

/** Mirrors the legacy acme encoder: standard base64 with `+`→`-`, `/`→`_`, no padding. */
const encodeAcme = (sku: string): string =>
  Buffer.from(sku, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('normalizeSku', () => {
  it('collapses identical pipe-separated parts to the first one', () => {
    expect(normalizeSku('5058O035|5058O035')).toBe('5058O035');
  });

  it('keeps distinct parts joined by a literal pipe', () => {
    expect(normalizeSku('5058O035|9911')).toBe('5058O035|9911');
  });

  it('trims each part', () => {
    expect(normalizeSku(' 126981644035 | 428130345038 ')).toBe('126981644035|428130345038');
    expect(normalizeSku(' A1 | A1 ')).toBe('A1');
  });

  it('returns single skus unchanged apart from trimming', () => {
    expect(normalizeSku('B0ABC12345')).toBe('B0ABC12345');
    expect(normalizeSku('  B0ABC12345 ')).toBe('B0ABC12345');
  });
});

describe('decodeSkuSegment', () => {
  it('returns the raw segment for non-acme vendors', () => {
    expect(decodeSkuSegment('B0ABC12345', 'amazon')).toBe('B0ABC12345');
    expect(decodeSkuSegment('12345678', 'target')).toBe('12345678');
  });

  it('normalizes pipe-joined segments for non-acme vendors', () => {
    expect(decodeSkuSegment('5058O035|5058O035', 'ebay')).toBe('5058O035');
  });

  it('decodes base64url acme segments', () => {
    expect(decodeSkuSegment(encodeAcme('ACME/123+X?'), 'acme')).toBe('ACME/123+X?');
    expect(decodeSkuSegment(encodeAcme('SKU-1'), 'acme')).toBe('SKU-1');
  });

  it('normalizes decoded acme skus', () => {
    expect(decodeSkuSegment(encodeAcme('X1|X1'), 'acme')).toBe('X1');
  });

  it('returns null for invalid acme base64url input', () => {
    expect(decodeSkuSegment('not base64!', 'acme')).toBeNull();
    expect(decodeSkuSegment('A', 'acme')).toBeNull();
    expect(decodeSkuSegment('', 'acme')).toBeNull();
  });

  it('returns null for an empty segment', () => {
    expect(decodeSkuSegment('', 'amazon')).toBeNull();
    expect(decodeSkuSegment(' | ', 'ebay')).toBeNull();
  });
});

describe('toRouteUrl', () => {
  it('strips the leading slash and decodes %7C to a literal pipe', () => {
    expect(
      toRouteUrl(
        '/ebay-126981644035%7C428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl.html',
      ),
    ).toBe(
      'ebay-126981644035|428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl.html',
    );
  });

  it('accepts lowercase %7c and literal pipes', () => {
    expect(toRouteUrl('/ebay-1%7c2-x.html')).toBe('ebay-1|2-x.html');
    expect(toRouteUrl('/ebay-406973145584|677173569820-some-title.html')).toBe(
      'ebay-406973145584|677173569820-some-title.html',
    );
  });

  it('decodes other percent-encoded characters', () => {
    expect(toRouteUrl('/amazon-B0ABC12345-caf%C3%A9.html')).toBe('amazon-B0ABC12345-café.html');
  });

  it('drops any query string or fragment', () => {
    expect(toRouteUrl('/amazon-B0ABC12345-sony-tv.html?utm=x#top')).toBe(
      'amazon-B0ABC12345-sony-tv.html',
    );
  });

  it('returns null for empty input', () => {
    expect(toRouteUrl('')).toBeNull();
    expect(toRouteUrl('/')).toBeNull();
    expect(toRouteUrl('   ')).toBeNull();
  });

  it('returns null instead of throwing on malformed percent-encoding', () => {
    expect(() => toRouteUrl('/ebay-1%E0%A4%A-x.html')).not.toThrow();
    expect(toRouteUrl('/ebay-1%E0%A4%A-x.html')).toBeNull();
    expect(toRouteUrl('/50%-off.html')).toBeNull();
  });

  it('returns null when decoding yields control characters', () => {
    expect(toRouteUrl('/amazon-B0ABC12345-a%00b.html')).toBeNull();
  });
});

describe('parseProductUrl', () => {
  it('parses an eBay URL with an encoded variant pipe', () => {
    expect(
      parseProductUrl(
        '/ebay-126981644035%7C428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl.html',
        { vendors },
      ),
    ).toEqual({
      vendor: 'ebay',
      sku: '126981644035|428130345038',
      urlKey:
        'ebay-126981644035|428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl',
      routeUrl:
        'ebay-126981644035|428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl.html',
    });
  });

  it('treats a literal pipe the same as %7C', () => {
    const literal = parseProductUrl('/ebay-406973145584|677173569820-some-title.html', { vendors });
    const encoded = parseProductUrl('/ebay-406973145584%7C677173569820-some-title.html', {
      vendors,
    });

    expect(literal).toEqual(encoded);
    expect(literal?.sku).toBe('406973145584|677173569820');
  });

  it('parses Amazon and Target URLs', () => {
    expect(parseProductUrl('/amazon-B0ABC12345-sony-tv.html', { vendors })).toEqual({
      vendor: 'amazon',
      sku: 'B0ABC12345',
      urlKey: 'amazon-B0ABC12345-sony-tv',
      routeUrl: 'amazon-B0ABC12345-sony-tv.html',
    });
    expect(parseProductUrl('/target-12345678-lamp.html', { vendors })?.sku).toBe('12345678');
  });

  it('accepts a URL without a slug', () => {
    expect(parseProductUrl('/amazon-B0ABC12345.html', { vendors })).toEqual({
      vendor: 'amazon',
      sku: 'B0ABC12345',
      urlKey: 'amazon-B0ABC12345',
      routeUrl: 'amazon-B0ABC12345.html',
    });
  });

  it('collapses duplicated variant skus', () => {
    expect(parseProductUrl('/ebay-5058O035%7C5058O035-shirt.html', { vendors })?.sku).toBe(
      '5058O035',
    );
  });

  describe('eBay ?var= alternate form', () => {
    it('appends the variant id when the sku segment has no pipe', () => {
      const result = parseProductUrl('/ebay-126981644035-gildan-shirt.html', {
        vendors,
        searchParams: new URLSearchParams('var=428130345038'),
      });

      expect(result?.sku).toBe('126981644035|428130345038');
      expect(result?.routeUrl).toBe('ebay-126981644035-gildan-shirt.html');
    });

    it('ignores the variant id when the sku segment already has a pipe', () => {
      const result = parseProductUrl('/ebay-126981644035%7C111-gildan-shirt.html', {
        vendors,
        searchParams: new URLSearchParams('var=428130345038'),
      });

      expect(result?.sku).toBe('126981644035|111');
    });

    it('ignores blank or unsafe variant ids', () => {
      for (const query of ['var=', 'var=%20', 'var=1|2', 'var=a%2Fb']) {
        const result = parseProductUrl('/ebay-126981644035-gildan-shirt.html', {
          vendors,
          searchParams: new URLSearchParams(query),
        });
        expect(result?.sku).toBe('126981644035');
      }
    });

    it('ignores the variant id for non-eBay vendors', () => {
      for (const path of ['/amazon-B0ABC12345-sony-tv.html', '/target-12345678-lamp.html']) {
        const result = parseProductUrl(path, {
          vendors,
          searchParams: new URLSearchParams('var=999'),
        });
        expect(result?.sku).not.toContain('|');
      }
    });

    it('collapses a variant id equal to the sku', () => {
      const result = parseProductUrl('/ebay-5058O035-shirt.html', {
        vendors,
        searchParams: new URLSearchParams('var=5058O035'),
      });

      expect(result?.sku).toBe('5058O035');
    });
  });

  describe('acme', () => {
    it('decodes the base64url sku segment', () => {
      const encoded = encodeAcme('ACME/123+X?');
      const result = parseProductUrl(`/acme-${encoded}-widget.html`, { vendors });

      expect(result).toEqual({
        vendor: 'acme',
        sku: 'ACME/123+X?',
        urlKey: `acme-${encoded}-widget`,
        routeUrl: `acme-${encoded}-widget.html`,
      });
    });

    it('returns null when the segment is not valid base64url', () => {
      expect(parseProductUrl('/acme-A-widget.html', { vendors })).toBeNull();
    });

    it('known limitation: an encoded sku containing "-" is split like legacy and mis-decoded', () => {
      // base64url of "??>" is "Pz8-": the "-" collides with the URL separator.
      const encoded = encodeAcme('??>');
      expect(encoded).toBe('Pz8-');

      const result = parseProductUrl(`/acme-${encoded}-widget.html`, { vendors });

      // Legacy parity: urlKey.split('-')[1] yields "Pz8", which decodes to "??"
      // instead of the real sku. Magento `route()` is the source of truth here.
      expect(result?.sku).toBe('??');
      expect(result?.sku).not.toBe('??>');
    });
  });

  describe('rejections', () => {
    it('returns null for unknown vendors', () => {
      expect(parseProductUrl('/walmart-123-x.html', { vendors })).toBeNull();
      expect(parseProductUrl('/about-us.html', { vendors })).toBeNull();
    });

    it('honors a custom vendor allow-list', () => {
      expect(parseProductUrl('/walmart-123-x.html', { vendors: ['walmart'] })?.vendor).toBe(
        'walmart',
      );
      expect(parseProductUrl('/amazon-B0ABC12345-x.html', { vendors: ['walmart'] })).toBeNull();
    });

    it('matches the vendor case-insensitively and returns it lowercase', () => {
      expect(parseProductUrl('/Amazon-B0ABC12345-x.html', { vendors })?.vendor).toBe('amazon');
    });

    it('returns null when the suffix is missing or different', () => {
      expect(parseProductUrl('/amazon-B0ABC12345-sony-tv', { vendors })).toBeNull();
      expect(parseProductUrl('/amazon-B0ABC12345-sony-tv.htm', { vendors })).toBeNull();
    });

    it('supports a custom suffix', () => {
      expect(parseProductUrl('/amazon-B0ABC12345-sony-tv', { vendors, suffix: '' })?.urlKey).toBe(
        'amazon-B0ABC12345-sony-tv',
      );
      expect(
        parseProductUrl('/amazon-B0ABC12345-sony-tv.php', { vendors, suffix: '.php' })?.sku,
      ).toBe('B0ABC12345');
    });

    it('returns null for empty sku segments', () => {
      expect(parseProductUrl('/amazon--sony-tv.html', { vendors })).toBeNull();
      expect(parseProductUrl('/amazon.html', { vendors })).toBeNull();
      expect(parseProductUrl('/.html', { vendors })).toBeNull();
    });

    it('returns null for nested paths', () => {
      expect(parseProductUrl('/es/amazon-B0ABC12345-x.html', { vendors })).toBeNull();
      expect(parseProductUrl('/amazon-B0ABC12345-a%2Fb.html', { vendors })).toBeNull();
    });

    it('returns null for malformed or empty input without throwing', () => {
      expect(parseProductUrl('', { vendors })).toBeNull();
      expect(parseProductUrl('/amazon-B0%E0%A4%A-x.html', { vendors })).toBeNull();
    });
  });
});

describe('matchSkuSearchUrl', () => {
  it('matches the header sku jump /{vendor}-{sku}-search.html', () => {
    expect(matchSkuSearchUrl('/amazon-B00IJ0ALYS-search.html', { vendors })).toEqual({
      vendor: 'amazon',
      skuSegment: 'B00IJ0ALYS',
    });
    expect(matchSkuSearchUrl('/ebay-405512345678-search.html', { vendors })).toEqual({
      vendor: 'ebay',
      skuSegment: '405512345678',
    });
  });

  it('matches the vendor case-insensitively and keeps the sku segment as typed', () => {
    expect(matchSkuSearchUrl('/AMAZON-b00ij0alys-search.html', { vendors })).toEqual({
      vendor: 'amazon',
      skuSegment: 'b00ij0alys',
    });
  });

  it('decodes the path once (an encoded variant pipe becomes literal) and ignores the query', () => {
    expect(matchSkuSearchUrl('/ebay-1%7C2-search.html?var=3', { vendors })).toEqual({
      vendor: 'ebay',
      skuSegment: '1|2',
    });
  });

  it('matches an empty sku segment (the page decides it is unusable)', () => {
    expect(matchSkuSearchUrl('/amazon--search.html', { vendors })).toEqual({
      vendor: 'amazon',
      skuSegment: '',
    });
  });

  it.each([
    '/amazon-B00X-other.html',
    '/amazon-B00X-best-search.html',
    '/amazon-B00X-SEARCH.html',
    '/amazon-B00X-search.htm',
    '/amazon-B00X-search',
    '/amazon-search.html',
    '/walmart-B00X-search.html',
    '/search.html',
    '/es/amazon-B00X-search.html',
    '/amazon-B0%E0%A4%A-search.html',
    '',
  ])('does not match %s', (pathname) => {
    expect(matchSkuSearchUrl(pathname, { vendors })).toBeNull();
  });

  it('honors a custom suffix', () => {
    expect(matchSkuSearchUrl('/amazon-B00X-search', { vendors, suffix: '' })).toEqual({
      vendor: 'amazon',
      skuSegment: 'B00X',
    });
  });
});

describe('buildCanonicalUrl', () => {
  const base = 'https://chupaprecios.com.mx';

  it('keeps the pipe literal (no %7C serialization)', () => {
    const url = buildCanonicalUrl(base, 'ebay-406973145584|677173569820-some-title.html');

    expect(url).toBe('https://chupaprecios.com.mx/ebay-406973145584|677173569820-some-title.html');
    expect(url).not.toContain('%7C');
  });

  it('normalizes an encoded pipe in the relative url to a literal pipe', () => {
    expect(buildCanonicalUrl(base, 'ebay-1%7C2-x.html')).toBe(
      'https://chupaprecios.com.mx/ebay-1|2-x.html',
    );
    expect(buildCanonicalUrl(base, 'ebay-1%7c2-x.html')).toBe(
      'https://chupaprecios.com.mx/ebay-1|2-x.html',
    );
  });

  it('joins with exactly one slash regardless of input slashes', () => {
    expect(buildCanonicalUrl(`${base}/`, '/amazon-B0ABC12345-x.html')).toBe(
      'https://chupaprecios.com.mx/amazon-B0ABC12345-x.html',
    );
    expect(buildCanonicalUrl(`${base}//`, '//amazon-B0ABC12345-x.html')).toBe(
      'https://chupaprecios.com.mx/amazon-B0ABC12345-x.html',
    );
  });

  it('drops the query string and fragment', () => {
    expect(buildCanonicalUrl(base, 'ebay-1-x.html?var=2#reviews')).toBe(
      'https://chupaprecios.com.mx/ebay-1-x.html',
    );
  });

  it('drops any query or fragment on the base url and keeps a base path', () => {
    expect(buildCanonicalUrl('https://example.com/shop/?a=1', 'amazon-1-x.html')).toBe(
      'https://example.com/shop/amazon-1-x.html',
    );
  });

  it('returns the base with a trailing slash for an empty relative url', () => {
    expect(buildCanonicalUrl(base, '')).toBe('https://chupaprecios.com.mx/');
  });

  it('throws for an invalid or non-http base url', () => {
    expect(() => buildCanonicalUrl('not a url', 'x.html')).toThrow();
    expect(() => buildCanonicalUrl('ftp://example.com', 'x.html')).toThrow();
  });
});
