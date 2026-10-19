import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPromoBarContent } from '@/modules/promo-bar/infrastructure/default-promo-bar-content';

describe('getPromoBarContent', () => {
  it('serves the four slides recovered from the Magento "top-banner-slider" block every 5s', () => {
    const content = getPromoBarContent();
    expect(content.interval).toBe(5000);
    expect(content.slides).toEqual([
      {
        highlight: 'Envío gratis',
        message: 'en compra mínima de $1,500*. *Promoción válida sólo para México.',
      },
      {
        highlight: 'Todos los productos de EE.UU. para tu empresa,',
        message: 'facturados y entregados a un clic en todo México.',
      },
      {
        highlight: 'Precios finales,',
        message: 'con IVA incluido y sin cargos adicionales.',
      },
      {
        highlight: '¡Ahora paga con',
        logo: {
          src: '/images/layout/payments/kueski.svg',
          alt: 'Kueski Pay',
          width: 91,
          height: 18,
        },
        highlightSuffix: '!',
        message: 'Compra hoy y paga después, sin necesidad de tarjeta de crédito.',
      },
    ]);
  });

  it('points the Kueski logo at an asset the app serves', () => {
    const logo = getPromoBarContent().slides.find((slide) => slide.logo)?.logo;
    expect(logo).toBeDefined();
    expect(existsSync(join(process.cwd(), 'public', logo!.src))).toBe(true);
  });
});
