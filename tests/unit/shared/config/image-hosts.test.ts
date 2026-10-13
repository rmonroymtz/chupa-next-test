import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_REMOTE_HOSTS,
  isOptimizableImageUrl,
  parseImageRemoteHosts,
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
  ])('%s → %s', (url, expected) => {
    expect(isOptimizableImageUrl(url, patterns)).toBe(expected);
  });
});
