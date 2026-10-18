import Image from 'next/image';
import type { PromoSlide as PromoSlideData } from '../domain/promo-bar';

/** One announcement: `**highlight** [logo] **highlightSuffix** message [cta]`. */
export function PromoSlide({ slide }: { slide: PromoSlideData }) {
  const hasLead = Boolean(slide.highlight || slide.logo || slide.highlightSuffix);
  return (
    <p className="m-0">
      {slide.highlight && <strong className="font-bold">{slide.highlight}</strong>}
      {slide.logo?.src && (
        <Image
          src={slide.logo.src}
          alt={slide.logo.alt}
          width={slide.logo.width}
          height={slide.logo.height}
          className="mx-1 inline-block h-4 w-auto align-middle"
        />
      )}
      {slide.highlightSuffix && <strong className="font-bold">{slide.highlightSuffix}</strong>}
      {hasLead && slide.message ? ' ' : null}
      {slide.message}
      {slide.cta?.href && (
        <a
          href={slide.cta.href}
          className="ml-2 font-semibold text-ds-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
        >
          {slide.cta.label}
        </a>
      )}
    </p>
  );
}
