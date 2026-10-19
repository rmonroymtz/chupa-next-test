'use client';

import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

interface PromoBarRotatorProps {
  /** Server-rendered slides; the first one is the server-rendered active slide. */
  readonly slides: readonly ReactNode[];
  /** Milliseconds each slide stays on screen. */
  readonly interval: number;
}

/**
 * Rotates the promo slides. Every slide is stacked in the same grid cell, so the
 * bar keeps the height of the tallest one and never shifts the page while it
 * rotates; inactive slides are invisible, `aria-hidden` and `inert`. Rotation
 * pauses while hovered or while focus is inside, and never starts with a single
 * slide or when the user prefers reduced motion (also the server state, so the
 * first render matches the server markup).
 */
export function PromoBarRotator({ slides, interval }: PromoBarRotatorProps) {
  const count = slides.length;
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReducedMotion(query.matches);
    update();
    // Safari < 14 only implements the deprecated addListener/removeListener.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  // Clamped at render: the slide set can shrink between renders.
  const active = Math.min(selected, count - 1);
  const rotating = count > 1 && !reducedMotion && !hovered && !focused;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setSelected((active + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [rotating, active, count, interval]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <div
      aria-live="off"
      className="grid"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      {slides.map((slide, index) => {
        const isActive = index === active;
        return (
          <div
            // Slides are a fixed, ordered list; the position is their identity.
            key={index}
            data-slot="promo-slide"
            aria-hidden={isActive ? undefined : true}
            inert={!isActive}
            className={`[grid-area:1/1] transition-[opacity,visibility] duration-400 ease-out motion-reduce:transition-none ${
              isActive ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
          >
            {slide}
          </div>
        );
      })}
    </div>
  );
}
