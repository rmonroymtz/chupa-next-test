import { describe, expect, it } from 'vitest';
import { toProductUrlKeys } from '@/modules/page-builder/domain/product-url-keys';

describe('toProductUrlKeys (legacy Products content type)', () => {
  it('takes the last path segment and strips the product url suffix', () => {
    expect(
      toProductUrlKeys(
        [
          'https://chupaprecios.com.mx/amazon-B0ABC-desk-lamp.html',
          '/catalog/ebay-123-shirt.html?utm=1#top',
          'target-999-chair.html/',
        ],
        '.html',
      ),
    ).toEqual(['amazon-B0ABC-desk-lamp', 'ebay-123-shirt', 'target-999-chair']);
  });

  it('decodes percent-encoding so `%7C` keys keep their literal `|`', () => {
    expect(toProductUrlKeys(['/ebay-1%7C2-shirt.html'], '.html')).toEqual(['ebay-1|2-shirt']);
  });

  it('keeps keys without the suffix and drops empty or duplicate ones', () => {
    expect(toProductUrlKeys(['/a-1-x', '/a-1-x', '', '/', 'https://x.test'], '.html')).toEqual([
      'a-1-x',
    ]);
  });

  it('works without a suffix', () => {
    expect(toProductUrlKeys(['/a-1-x.html'], '')).toEqual(['a-1-x.html']);
  });

  it('protocol-relative links: a bare host is not a key, a path is', () => {
    expect(toProductUrlKeys(['//example.com', '//example.com/'], '.html')).toEqual([]);
    expect(toProductUrlKeys(['//example.com/a-1-x.html?x=1'], '.html')).toEqual(['a-1-x']);
  });
});
