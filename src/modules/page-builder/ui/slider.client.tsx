'use client';

import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './page-builder.module.css';

export interface SliderProps {
  /** Server-rendered slides. */
  readonly slides: readonly ReactNode[];
  /** Accessible slide names (falls back to "Diapositiva N de M"). */
  readonly slideNames: readonly (string | null)[];
  readonly autoplay: boolean;
  readonly autoplaySpeed: number;
  readonly fade: boolean;
  readonly infinite: boolean;
  readonly showArrows: boolean;
  readonly showDots: boolean;
  readonly className: string;
  readonly style: CSSProperties;
  readonly styleId?: string | undefined;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Page Builder slider: an accessible carousel (WAI-ARIA APG pattern) with no
 * carousel library. Slides are stacked in one grid cell, so the tallest one
 * sizes the slider and switching never shifts layout; without JavaScript the
 * first slide shows. Autoplay pauses on hover and focus, offers a pause
 * button, and never starts for visitors who prefer reduced motion.
 */
export function Slider({
  slides,
  slideNames,
  autoplay,
  autoplaySpeed,
  fade,
  infinite,
  showArrows,
  showDots,
  className,
  style,
  styleId,
}: SliderProps) {
  const id = useId();
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      if (infinite) setActive(((index % count) + count) % count);
      else setActive(Math.min(Math.max(index, 0), count - 1));
    },
    [count, infinite],
  );

  const rotating = autoplay && count > 1 && !paused && !hovered && !focused && !reducedMotion;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1 < count ? current + 1 : infinite ? 0 : current));
    }, autoplaySpeed);
    return () => window.clearInterval(timer);
  }, [rotating, autoplaySpeed, count, infinite]);

  if (count === 0) return null;
  const canGoBack = infinite || active > 0;
  const canGoForward = infinite || active < count - 1;

  return (
    <section
      className={`${styles.slider} ${className}`}
      style={style}
      data-pb-style={styleId}
      aria-roledescription="carrusel"
      aria-label="Promociones"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {autoplay && count > 1 && !reducedMotion ? (
        <button
          type="button"
          className={styles.sliderPause}
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Reanudar carrusel' : 'Pausar carrusel'}
        >
          <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        </button>
      ) : null}
      <div className={styles.slides} aria-live={rotating ? 'off' : 'polite'} id={`${id}-slides`}>
        {slides.map((slide, index) => {
          const isActive = index === active;
          const slideStyle: CSSProperties | undefined = fade
            ? undefined
            : { transform: `translateX(${(index - active) * 100}%)` };
          return (
            <div
              key={index}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={slideNames[index] ?? `Diapositiva ${index + 1} de ${count}`}
              className={`${styles.slide} ${fade ? styles.slideFade : ''}`}
              style={slideStyle}
              data-active={isActive}
              // Hidden slides leave the tab order and the accessibility tree.
              inert={!isActive}
            >
              {slide}
            </div>
          );
        })}
      </div>
      {showArrows && count > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.sliderArrow} ${styles.sliderPrev}`}
            onClick={() => goTo(active - 1)}
            disabled={!canGoBack}
            aria-controls={`${id}-slides`}
            aria-label="Diapositiva anterior"
          >
            <Arrow direction="left" />
          </button>
          <button
            type="button"
            className={`${styles.sliderArrow} ${styles.sliderNext}`}
            onClick={() => goTo(active + 1)}
            disabled={!canGoForward}
            aria-controls={`${id}-slides`}
            aria-label="Diapositiva siguiente"
          >
            <Arrow direction="right" />
          </button>
        </>
      ) : null}
      {showDots && count > 1 ? (
        <ul className={styles.sliderDots}>
          {slides.map((_, index) => (
            <li key={index}>
              <button
                type="button"
                className={styles.sliderDot}
                onClick={() => goTo(index)}
                aria-controls={`${id}-slides`}
                aria-current={index === active}
                aria-label={`Ir a la diapositiva ${index + 1}`}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Arrow({ direction }: { readonly direction: 'left' | 'right' }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="black"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </>
      ) : (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      )}
    </svg>
  );
}
