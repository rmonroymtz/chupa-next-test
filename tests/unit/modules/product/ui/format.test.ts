import { describe, expect, it } from 'vitest';
import { formatPrice } from '@/modules/product/ui/format-price';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';

describe('formatPrice', () => {
  it('formats MXN amounts exactly as returned, with es-MX conventions', () => {
    expect(formatPrice(1145.13, 'MXN')).toBe('$1,145.13');
    expect(formatPrice(99, 'MXN')).toBe('$99.00');
  });

  it('shows the currency code for non-MXN currencies', () => {
    expect(formatPrice(9.99, 'USD')).toMatch(/USD\s?9\.99/);
  });

  it('falls back to the plain amount and code for an invalid currency', () => {
    expect(formatPrice(10, 'pesos')).toBe('10.00 pesos');
  });

  it('never throws on malformed runtime values (rendering must not fail on a price)', () => {
    const loose = formatPrice as (amount: unknown, currency: unknown) => string;
    expect(() => loose('12.5', 'pesos')).not.toThrow();
    expect(loose('12.5', 'pesos')).toBe('12.50 pesos');
    expect(() => loose(null, null)).not.toThrow();
    expect(() => loose(Symbol('x'), {})).not.toThrow();
  });
});

describe('htmlToPlainText', () => {
  it('drops tags, scripts and styles and keeps the text', () => {
    expect(
      htmlToPlainText(
        '<p>Hola <b>mundo</b></p><script>alert(1)</script><style>p{}</style><ul><li>Uno</li><li>Dos</li></ul>',
      ),
    ).toBe('Hola mundo\nUno\nDos');
  });

  it('decodes common entities without producing markup', () => {
    expect(htmlToPlainText('5 &lt; 6 &amp; &quot;x&quot; &#39;y&#39; &nbsp;z &#x41;')).toBe(
      '5 < 6 & "x" \'y\' z A',
    );
  });

  it('returns an empty string for empty markup', () => {
    expect(htmlToPlainText('<ul class="a"></ul>')).toBe('');
  });
});
