import { describe, expect, it } from 'vitest';
import { buildRobotsTxt } from '@/modules/seo/domain/robots-txt';

const directives = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

describe('buildRobotsTxt', () => {
  const text = buildRobotsTxt('https://chupaprecios.com.mx');

  it('replicates every production rule in order', () => {
    expect(directives(text)).toEqual([
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /index.php/',
      'Disallow: /customer/',
      'Disallow: /checkout/',
      'Disallow: /wishlist/',
      'Disallow: /compare/',
      'Disallow: /review/',
      'Disallow: /sendfriend/',
      'Disallow: /newsletter/',
      'Disallow: /sales/',
      'Disallow: /reports/',
      'Disallow: /downloadable/',
      'Disallow: /giftregistry/',
      'Disallow: /paypal/',
      'Disallow: /errors/',
      'Disallow: /cron.php',
      'Disallow: /graphql',
      'Disallow: /rest/',
      'Disallow: /swagger',
      'Disallow: /catalogsearch/',
      'Disallow: /search/',
      'Disallow: /*?*',
      'Disallow: /*&*',
      'Disallow: /*?p=',
      'Disallow: /*?limit=',
      'Disallow: /*?product_list_mode=',
      'Disallow: /*?product_list_order=',
      'Disallow: /*?product_list_dir=',
      'Disallow: /*?utm_',
      'Disallow: /*?gclid=',
      'Disallow: /*?fbclid=',
      'Allow: /static/',
      'Allow: /static/version',
      'Allow: /media/catalog/product/',
      'Allow: /media/catalog/category/',
      'Allow: /media/logo/',
      'Sitemap: https://chupaprecios.com.mx/sitemap.xml',
    ]);
  });

  it('declares exactly one sitemap, on the public base url (Magento serves it)', () => {
    const sitemaps = directives(buildRobotsTxt('https://staging.example.com/')).filter((line) =>
      line.startsWith('Sitemap:'),
    );
    expect(sitemaps).toEqual(['Sitemap: https://staging.example.com/sitemap.xml']);
  });

  it('ends with a newline', () => {
    expect(text.endsWith('\n')).toBe(true);
  });
});
