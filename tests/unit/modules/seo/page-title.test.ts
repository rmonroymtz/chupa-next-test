import { describe, expect, it } from 'vitest';
import { withoutSiteNameSuffix } from '@/modules/seo/domain/page-title';
import { SITE_NAME } from '@/modules/seo/domain/site';

describe('withoutSiteNameSuffix', () => {
  it('removes a trailing "| <site name>" so the title template adds it only once', () => {
    expect(withoutSiteNameSuffix(`Laptops | ${SITE_NAME}`)).toBe('Laptops');
  });

  it.each(['-', '–', '—', ':', '|'])('accepts "%s" as separator', (separator) => {
    expect(withoutSiteNameSuffix(`Laptops ${separator} ${SITE_NAME}`)).toBe('Laptops');
  });

  it('ignores case and surrounding whitespace', () => {
    expect(withoutSiteNameSuffix('  Laptops   |   chupaPRECIOS  ')).toBe('Laptops');
    expect(withoutSiteNameSuffix('Laptops|Chupaprecios')).toBe('Laptops');
  });

  it('removes a repeated suffix', () => {
    expect(withoutSiteNameSuffix('Laptops | Chupaprecios | Chupaprecios')).toBe('Laptops');
  });

  it('keeps the site name when it is not a trailing suffix', () => {
    expect(withoutSiteNameSuffix('Chupaprecios | Ofertas')).toBe('Chupaprecios | Ofertas');
    expect(withoutSiteNameSuffix('Ofertas Chupaprecios')).toBe('Ofertas Chupaprecios');
    expect(withoutSiteNameSuffix('Laptops | Chupapreciosmx')).toBe('Laptops | Chupapreciosmx');
  });

  it('keeps an inner separator', () => {
    expect(withoutSiteNameSuffix('Audífonos Sony | Oferta')).toBe('Audífonos Sony | Oferta');
  });

  it('returns null for an empty title or one that is only the site name', () => {
    expect(withoutSiteNameSuffix(null)).toBeNull();
    expect(withoutSiteNameSuffix('   ')).toBeNull();
    expect(withoutSiteNameSuffix('Chupaprecios')).toBeNull();
    expect(withoutSiteNameSuffix(' | Chupaprecios')).toBeNull();
  });

  it('uses the given site name and escapes it', () => {
    expect(withoutSiteNameSuffix('Ofertas | Tienda (MX)', 'Tienda (MX)')).toBe('Ofertas');
    expect(withoutSiteNameSuffix('Ofertas | Chupaprecios', 'Tienda (MX)')).toBe(
      'Ofertas | Chupaprecios',
    );
  });
});
