'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from './icons';

/** Share of the visible width each arrow click scrolls (keeps some context). */
const SCROLL_STEP = 0.8;
/** Sub-pixel tolerance: zoomed layouts rarely land exactly on the edges. */
const EDGE_TOLERANCE_PX = 1;

interface Overflow {
  readonly start: boolean;
  readonly end: boolean;
}

const NO_OVERFLOW: Overflow = { start: false, end: false };

function measure(element: HTMLElement): Overflow {
  const { scrollLeft, scrollWidth, clientWidth } = element;
  return {
    start: scrollLeft > EDGE_TOLERANCE_PX,
    end: scrollLeft + clientWidth < scrollWidth - EDGE_TOLERANCE_PX,
  };
}

/**
 * Horizontal scroller for the desktop category bar. The list itself stays
 * server-rendered (every category link is in the HTML); this only adds the
 * side arrows. Without JavaScript, or before hydration, the bar is still
 * natively scrollable and the arrows are absent: they overlay the bar
 * (positioned against the `relative` nav), so showing them shifts nothing.
 *
 * The scroll container must stay unpositioned: the dropdown panels are
 * positioned against the nav, an ancestor of this container, so its
 * `overflow` does not clip them.
 */
export function CategoryNavScroller({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>(NO_OVERFLOW);

  const update = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = measure(element);
    setOverflow((previous) =>
      previous.start === next.start && previous.end === next.end ? previous : next,
    );
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    update();
    window.addEventListener('resize', update);
    // Fonts loading or the menu changing resize the list without a window resize.
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => update()) : null;
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [update]);

  const scroll = (direction: -1 | 1) => {
    const element = ref.current;
    if (!element) return;
    // Smoothness comes from CSS (`motion-safe:scroll-smooth`), so visitors who
    // prefer reduced motion get an instant jump.
    element.scrollBy({ left: direction * Math.round(element.clientWidth * SCROLL_STEP) });
  };

  return (
    <>
      <div
        ref={ref}
        onScroll={update}
        className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {overflow.start ? (
        <button
          type="button"
          aria-label="Desplazar categorías a la izquierda"
          onClick={() => scroll(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-start bg-linear-to-r from-white from-60% to-transparent ps-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <ChevronDownIcon className="size-5 rotate-90" />
        </button>
      ) : null}
      {overflow.end ? (
        <button
          type="button"
          aria-label="Desplazar categorías a la derecha"
          onClick={() => scroll(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end bg-linear-to-l from-white from-60% to-transparent pe-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <ChevronDownIcon className="size-5 -rotate-90" />
        </button>
      ) : null}
    </>
  );
}
