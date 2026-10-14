import { describe, expect, it } from 'vitest';
import { buildBreadcrumbListJsonLd } from '@/modules/seo/domain/breadcrumb-list';

describe('buildBreadcrumbListJsonLd', () => {
  it('numbers the trail from 1 in the given order', () => {
    expect(
      buildBreadcrumbListJsonLd([
        { name: 'Inicio', item: 'https://chupaprecios.com.mx/' },
        { name: 'Electrónica', item: 'https://chupaprecios.com.mx/electronica.html' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://chupaprecios.com.mx/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Electrónica',
          item: 'https://chupaprecios.com.mx/electronica.html',
        },
      ],
    });
  });
});
