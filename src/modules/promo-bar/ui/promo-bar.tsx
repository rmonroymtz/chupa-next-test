import { hasPromoContent, type PromoBarContent } from '../domain/promo-bar';
import { getPromoBarContent } from '../infrastructure/default-promo-bar-content';
import { PromoBarRotator } from './promo-bar-rotator.client';
import { PromoSlide } from './promo-slide';

/**
 * Site-wide announcement bar above the header (DS PromoBar molecule): white
 * surface, centered 12/16 neutral-800 text with a bold lead. Slides render on
 * the server; only the rotation runs on the client.
 */
export function PromoBar({ content = getPromoBarContent() }: { content?: PromoBarContent }) {
  const slides = content.slides.filter(hasPromoContent);
  if (slides.length === 0) return null;
  return (
    <section
      aria-label="Promociones"
      className="border-b border-ds-border bg-ds-surface text-center text-caption text-ds-text"
    >
      <div className="container-padded py-2">
        <PromoBarRotator
          interval={content.interval}
          slides={slides.map((slide, index) => (
            <PromoSlide key={index} slide={slide} />
          ))}
        />
      </div>
    </section>
  );
}
