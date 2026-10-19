/**
 * Static footer content, copied from the redesigned PWA footer
 * (`CHUP-redesign` `overrides/@magento/venia-ui/lib/components/Footer/footer.js`).
 * Internal paths are pages PWA Studio (or Magento CMS) serves: rendered as
 * plain anchors.
 */
export interface FooterLink {
  readonly label: string;
  readonly href: string;
}

export interface SocialLink extends FooterLink {
  readonly network: 'facebook' | 'instagram';
}

export const HELP_LINKS: readonly FooterLink[] = [
  { label: 'Preguntas Frecuentes (FAQ)', href: '/preguntas-frecuentes' },
];

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    network: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/p/Chupaprecios-100070557248938/',
  },
  { network: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/chupaprecios/' },
];

export const ABOUT_LINKS: readonly FooterLink[] = [
  { label: 'Acerca de Chupaprecios', href: '/acerca-de-chupaprecios' },
  { label: 'Términos y Condiciones', href: '/terminos-y-condiciones' },
  { label: 'Política de Privacidad', href: '/aviso-privacidad' },
  { label: 'Propiedad Intelectual', href: '/propiedad-intelectual' },
];

export const CUSTOMER_SERVICE = {
  phone: { label: '(+52) 664 311 9682', href: 'tel:+526643119682' },
  hours: [
    { days: 'Lunes a Sábados:', time: '08:00 a 17:00', note: '(hora del Pacífico)' },
    { days: 'Domingo:', time: 'Cerrado', note: null },
  ],
} as const;

export const OFFICES: readonly { readonly title: string; readonly lines: readonly string[] }[] = [
  {
    title: 'Oficina central',
    lines: ['Calle Centro Comercial 17206', 'Col. Otay Constituyentes', 'C.P. 22457 Tijuana, BC.'],
  },
  {
    title: 'Centro de desarrollo tecnológico',
    lines: [
      'Calle Montes Urales - Virreyes 424, Oficina 01A-129',
      'Lomas de Chapultepec V Sección, Miguel Hidalgo',
      'C.P. 11000, Ciudad de México, CDMX.',
    ],
  },
];

/**
 * The PWA footer `PAYMENTS` set and order; sizes keep each logo's aspect ratio
 * at 15px high. (The Mercado Pago and Kueski assets stay in `public/` unused.)
 */
export const PAYMENT_METHODS: readonly {
  readonly id: string;
  readonly label: string;
  readonly width: number;
}[] = [
  { id: 'visa', label: 'Visa', width: 53 },
  { id: 'mastercard', label: 'Mastercard', width: 19 },
  { id: 'paypal', label: 'PayPal', width: 57 },
  { id: 'oxxo', label: 'OXXO', width: 30 },
  { id: 'amex', label: 'American Express', width: 22 },
  { id: 'spei', label: 'SPEI', width: 44 },
];

export const PAYMENT_LOGO_HEIGHT = 15;
