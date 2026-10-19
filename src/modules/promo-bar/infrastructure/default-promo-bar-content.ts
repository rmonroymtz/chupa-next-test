import type { PromoBarContent } from '../domain/promo-bar';

/**
 * Static promo bar content: the four slides of the Magento CMS block
 * `top-banner-slider` (texts only, no Page Builder markup), as recovered by the
 * PWA's `usePromoBar` default. No headless promo API exists yet; when one does,
 * only this function changes and the bar stays as is.
 */
const DEFAULT_PROMO_BAR: PromoBarContent = {
  interval: 5000,
  slides: [
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
      logo: { src: '/images/layout/payments/kueski.svg', alt: 'Kueski Pay', width: 91, height: 18 },
      highlightSuffix: '!',
      message: 'Compra hoy y paga después, sin necesidad de tarjeta de crédito.',
    },
  ],
};

export function getPromoBarContent(): PromoBarContent {
  return DEFAULT_PROMO_BAR;
}
