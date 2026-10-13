import { describe, expect, it } from 'vitest';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/modules/seo/domain/site-structured-data';

const BASE = 'https://chupaprecios.com.mx';

describe('buildOrganizationJsonLd', () => {
  it('describes Chupaprecios with logo and social profiles when configured', () => {
    expect(
      buildOrganizationJsonLd({
        baseUrl: BASE,
        logoUrl: `${BASE}/media/logo/logo.png`,
        sameAs: ['https://www.facebook.com/chupaprecios', 'https://www.instagram.com/chupaprecios'],
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'Chupaprecios',
      url: `${BASE}/`,
      logo: `${BASE}/media/logo/logo.png`,
      sameAs: ['https://www.facebook.com/chupaprecios', 'https://www.instagram.com/chupaprecios'],
    });
  });

  it('omits logo and sameAs when not configured', () => {
    const organization = buildOrganizationJsonLd({ baseUrl: BASE, logoUrl: null, sameAs: [] });
    expect(organization).not.toHaveProperty('logo');
    expect(organization).not.toHaveProperty('sameAs');
  });
});

describe('buildWebSiteJsonLd', () => {
  it('declares the legacy search page as the sitelinks search action', () => {
    expect(buildWebSiteJsonLd({ baseUrl: BASE })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      name: 'Chupaprecios',
      url: `${BASE}/`,
      inLanguage: 'es-MX',
      publisher: { '@id': `${BASE}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE}/search.html?query={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    });
  });
});
