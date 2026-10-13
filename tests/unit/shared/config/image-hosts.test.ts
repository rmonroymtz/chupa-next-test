import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_REMOTE_HOSTS,
  isOptimizableImageUrl,
  parseImageRemoteHosts,
  toNextRemotePatterns,
} from '@/shared/config/image-hosts';

describe('parseImageRemoteHosts', () => {
  it('uses the defaults when unset or blank', () => {
    expect(parseImageRemoteHosts(undefined)).toEqual(
      parseImageRemoteHosts(DEFAULT_IMAGE_REMOTE_HOSTS.join(',')),
    );
    expect(parseImageRemoteHosts('  ')).toEqual(parseImageRemoteHosts(undefined));
  });

  it('parses hosts with optional path globs into https remote patterns', () => {
    expect(parseImageRemoteHosts('chupaprecios.com.mx/media/**, i.ebayimg.com')).toEqual([
      { protocol: 'https', hostname: 'chupaprecios.com.mx', pathname: '/media/**' },
      { protocol: 'https', hostname: 'i.ebayimg.com', pathname: '/**' },
    ]);
  });

  it('includes the Magento media path and the scraped image hosts by default', () => {
    const hosts = parseImageRemoteHosts(undefined).map((p) => `${p.hostname}${p.pathname}`);
    expect(hosts).toEqual([
      'chupaprecios.com.mx/media/**',
      'i.ebayimg.com/**',
      'm.media-amazon.com/**',
      'target.scene7.com/**',
    ]);
  });
});

describe('isOptimizableImageUrl', () => {
  const patterns = parseImageRemoteHosts(undefined);

  it.each([
    ['https://chupaprecios.com.mx/media/catalog/a.jpg', true],
    ['https://chupaprecios.com.mx/other/a.jpg', false],
    ['https://i.ebayimg.com/images/g/x/s-l1600.jpg', true],
    ['http://i.ebayimg.com/images/x.jpg', false],
    ['https://evil.example.com/a.jpg', false],
    ['not a url', false],
    // Vendor CDNs use the query for resizing/signing: never sent to the optimizer.
    ['https://i.ebayimg.com/images/g/x/s-l1600.jpg?set_id=880000500F', false],
    ['https://chupaprecios.com.mx/media/catalog/a.jpg?width=300', false],
  ])('%s → %s', (url, expected) => {
    expect(isOptimizableImageUrl(url, patterns)).toBe(expected);
  });

  // The optimizer rejects what `images.remotePatterns` does not match, so the
  // UI must never mark such a url optimizable (it would render a broken image).
  it.each([
    'https://chupaprecios.com.mx/media/catalog/a.jpg',
    'https://chupaprecios.com.mx/media/catalog/a.jpg?width=300',
    'https://chupaprecios.com.mx/media/catalog/a.jpg?',
    'https://chupaprecios.com.mx/media',
    'https://chupaprecios.com.mx/other/a.jpg',
    'https://i.ebayimg.com/images/g/x/s-l1600.jpg',
    'https://i.ebayimg.com/images/g/x/s-l1600.jpg?set_id=880000500F',
    'https://m.media-amazon.com/images/I/71abc._AC_SL1500_.jpg',
    'https://target.scene7.com/is/image/Target/GUEST_1?wid=800&hei=800',
    'https://I.EBAYIMG.COM/images/x.jpg',
    'https://i.ebayimg.com:8443/images/x.jpg',
    'http://i.ebayimg.com/images/x.jpg',
    'https://sub.i.ebayimg.com/images/x.jpg',
  ])('agrees with the Next.js optimizer patterns for %s', (url) => {
    const nextAccepts = toNextRemotePatterns(patterns).some((pattern) =>
      matchRemotePattern(pattern, new URL(url)),
    );
    expect(isOptimizableImageUrl(url, patterns)).toBe(nextAccepts);
  });
});

describe('toNextRemotePatterns', () => {
  it('requires an empty query string so signed or resized vendor variants are not proxied', () => {
    expect(toNextRemotePatterns(parseImageRemoteHosts('i.ebayimg.com'))).toEqual([
      { protocol: 'https', hostname: 'i.ebayimg.com', pathname: '/**', search: '' },
    ]);
  });
});
