'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** PWA `itemsPerView`: the sliders show 5 cards on desktop. */
const ITEMS_PER_VIEW = 5;

interface ProductCarouselProps {
  /** Number of slides in the track; the carousel loops only when they do not all fit. */
  readonly itemCount: number;
  readonly itemsPerView?: number;
  /** The track: one list whose items are the slides (server-rendered). */
  readonly children: ReactNode;
}

/**
 * The PWA `RandomSliders/ProductCarousel` (embla): an `overflow:hidden`
 * viewport around the server-rendered track, prev/next arrows and one dot per
 * page. Embla only enhances: before it starts, the first cards show and both
 * arrows are disabled (as the PWA). With reduced motion the arrows and dots
 * jump instead of animating.
 */
export function ProductCarousel({
  itemCount,
  itemsPerView = ITEMS_PER_VIEW,
  children,
}: ProductCarouselProps) {
  // Same options as the PWA `useCarousel.js`.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    slidesToScroll: 'auto',
    containScroll: 'trimSnaps',
    loop: itemCount > itemsPerView,
    breakpoints: {
      '(max-width: 640px)': { slidesToScroll: 2 },
      '(min-width: 641px) and (max-width: 1024px)': { slidesToScroll: 3 },
    },
  });
  const reducedMotion = usePrefersReducedMotion();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedPage, setSelectedPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
      setSelectedPage(emblaApi.selectedScrollSnap());
      // The PWA counts the pages once; recounting on reInit keeps the dots right after a breakpoint change.
      setTotalPages(emblaApi.scrollSnapList().length);
    };
    sync();
    emblaApi.on('select', sync);
    emblaApi.on('reInit', sync);
    return () => {
      emblaApi.off('select', sync);
      emblaApi.off('reInit', sync);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(
    () => emblaApi?.scrollPrev(reducedMotion),
    [emblaApi, reducedMotion],
  );
  const scrollNext = useCallback(
    () => emblaApi?.scrollNext(reducedMotion),
    [emblaApi, reducedMotion],
  );
  const goToPage = (index: number) => emblaApi?.scrollTo(index, reducedMotion);

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          className={`${ARROW} -left-3 max-[1023px]:-left-2`}
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          aria-label="Producto anterior"
        >
          <Chevron d="M8.5 1L1.5 8L8.5 15" />
        </button>
        <div data-carousel-viewport="" className="overflow-hidden" ref={emblaRef}>
          {children}
        </div>
        <button
          type="button"
          className={`${ARROW} -right-3 max-[1023px]:-right-2`}
          onClick={scrollNext}
          disabled={!canScrollNext}
          aria-label="Siguiente producto"
        >
          <Chevron d="M1.5 1L8.5 8L1.5 15" />
        </button>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-[6px]">
          {Array.from({ length: totalPages }, (_, index) => {
            const active = index === selectedPage;
            return (
              <button
                key={index}
                type="button"
                data-active={active}
                className={`cursor-pointer rounded-pill border-0 p-0 transition-all duration-200 motion-reduce:transition-none ${
                  active ? 'h-[6px] w-[18px] bg-ds-accent' : 'size-[5px] bg-ds-neutral-300'
                }`}
                onClick={() => goToPage(index)}
                aria-label={`Página ${index + 1} de ${totalPages}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** PWA `.arrow`: 40×64 white tab centered on the track, hidden below 640px. */
const ARROW = [
  'absolute top-1/2 z-10 flex h-16 w-10 -translate-y-1/2 cursor-pointer items-center justify-center',
  'rounded-sm border-0 bg-ds-surface text-ds-text shadow-[0_2px_8px_rgb(0_0_0/0.08)]',
  'transition-[box-shadow,background-color] duration-150 motion-reduce:transition-none',
  'enabled:hover:bg-ds-surface-subtle enabled:hover:shadow-[0_4px_12px_rgb(0_0_0/0.12)]',
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-[0_1px_3px_rgb(0_0_0/0.06)]',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus',
  'max-[639px]:hidden',
].join(' ');

function Chevron({ d }: { readonly d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 10 16" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** False on the server and until the media query is read (animated scrolling is embla's default). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReduced(query.matches);
    update();
    // Safari < 14 only implements the deprecated addListener/removeListener.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);
  return reduced;
}
