import { describe, expect, it } from 'vitest';
import { hasPromoContent } from '@/modules/promo-bar/domain/promo-bar';

describe('hasPromoContent', () => {
  it('accepts a slide with a highlight, a message, a logo or a cta', () => {
    expect(hasPromoContent({ highlight: 'Envío gratis' })).toBe(true);
    expect(hasPromoContent({ message: 'Hoy' })).toBe(true);
    expect(hasPromoContent({ logo: { src: '/a.svg', alt: 'A', width: 1, height: 1 } })).toBe(true);
    expect(hasPromoContent({ cta: { label: 'Ver', href: '/ofertas' } })).toBe(true);
  });

  it('rejects an empty slide, a suffix alone or a cta without href', () => {
    expect(hasPromoContent({})).toBe(false);
    expect(hasPromoContent({ highlightSuffix: '!' })).toBe(false);
    expect(hasPromoContent({ cta: { label: 'Ver', href: '' } })).toBe(false);
  });
});
