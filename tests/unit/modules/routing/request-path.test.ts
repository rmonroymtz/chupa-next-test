import { describe, expect, it } from 'vitest';
import { toPathname, toSearch } from '@/modules/routing/domain/request-path';

describe('toPathname', () => {
  it('maps the site root (no catch-all segments) to /', () => {
    expect(toPathname(undefined)).toBe('/');
    expect(toPathname([])).toBe('/');
  });

  it('joins segments with one encoded form, whether Next passed them decoded or not', () => {
    expect(toPathname(['ebay-1|2-x.html'])).toBe('/ebay-1%7C2-x.html');
    expect(toPathname(['ebay-1%7C2-x.html'])).toBe('/ebay-1%7C2-x.html');
    expect(toPathname(['customer', 'account'])).toBe('/customer/account');
  });

  it('keeps a literal % that is not valid percent-encoding', () => {
    expect(toPathname(['50%-off'])).toBe('/50%25-off');
  });
});

describe('toSearch', () => {
  it('serializes repeated and single values and skips undefined ones', () => {
    expect(toSearch({ page: '2', tag: ['a', 'b'], empty: undefined })).toBe('page=2&tag=a&tag=b');
  });
});
