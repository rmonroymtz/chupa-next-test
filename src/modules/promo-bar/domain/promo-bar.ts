/**
 * Promo bar content: the short announcements rotating above the site header.
 *
 * A slide renders as `**highlight** [logo] **highlightSuffix** message [cta]`;
 * the bold lead can wrap an inline logo ("¡Ahora paga con {Kueski Pay}!").
 */
export interface PromoLogo {
  /** Public path of the image, e.g. `/images/layout/payments/kueski.svg`. */
  readonly src: string;
  readonly alt: string;
  /** Intrinsic size of the asset; the bar scales it to its line height. */
  readonly width: number;
  readonly height: number;
}

export interface PromoCta {
  readonly label: string;
  readonly href: string;
}

export interface PromoSlide {
  readonly highlight?: string;
  readonly logo?: PromoLogo;
  readonly highlightSuffix?: string;
  readonly message?: string;
  readonly cta?: PromoCta;
}

export interface PromoBarContent {
  /** Auto-rotation interval in milliseconds. */
  readonly interval: number;
  readonly slides: readonly PromoSlide[];
}

/** A slide renders only when it has something to say or show. */
export function hasPromoContent(slide: PromoSlide): boolean {
  return Boolean(slide.highlight || slide.message || slide.logo?.src || slide.cta?.href);
}
