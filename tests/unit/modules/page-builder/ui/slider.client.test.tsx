// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Slider, type SliderProps } from '@/modules/page-builder/ui/slider.client';

type Listener = () => void;

/** matchMedia stub; `legacy` exposes only addListener/removeListener (old Safari). */
function stubMatchMedia(options: { reduced?: boolean; legacy?: boolean } = {}) {
  const listeners = new Set<Listener>();
  const addListener = vi.fn((listener: Listener) => void listeners.add(listener));
  const removeListener = vi.fn((listener: Listener) => void listeners.delete(listener));
  const query = {
    matches: options.reduced ?? false,
    media: '(prefers-reduced-motion: reduce)',
    addListener,
    removeListener,
    ...(options.legacy
      ? {}
      : {
          addEventListener: vi.fn((_: string, listener: Listener) => addListener(listener)),
          removeEventListener: vi.fn((_: string, listener: Listener) => removeListener(listener)),
        }),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  return {
    listeners,
    addListener,
    removeListener,
    change(matches: boolean) {
      query.matches = matches;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

const SLIDES = ['Uno', 'Dos', 'Tres'];

function renderSlider(props: Partial<SliderProps> = {}) {
  const element = (overrides: Partial<SliderProps> = {}) => {
    const merged = { slides: SLIDES, ...props, ...overrides };
    return (
      <Slider
        slideNames={merged.slides.map(() => null)}
        autoplay={false}
        autoplaySpeed={4000}
        fade={false}
        infinite={false}
        showArrows
        showDots
        className=""
        style={{}}
        {...merged}
      />
    );
  };
  const result = render(element());
  return {
    ...result,
    rerenderWith: (overrides: Partial<SliderProps>) => result.rerender(element(overrides)),
  };
}

const slides = () => screen.getAllByRole('group', { hidden: true });
const activeIndex = () => slides().findIndex((slide) => slide.dataset.active === 'true');
const next = () => screen.getByRole('button', { name: 'Diapositiva siguiente' });
const prev = () => screen.getByRole('button', { name: 'Diapositiva anterior' });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Slider', () => {
  it('renders nothing without slides', () => {
    stubMatchMedia();
    const { container } = renderSlider({ slides: [] });
    expect(container.innerHTML).toBe('');
  });

  it('non-infinite arrows clamp at both ends', () => {
    stubMatchMedia();
    renderSlider();
    expect(activeIndex()).toBe(0);
    expect(prev()).toHaveProperty('disabled', true);
    fireEvent.click(next());
    fireEvent.click(next());
    expect(activeIndex()).toBe(2);
    expect(next()).toHaveProperty('disabled', true);
  });

  it('infinite arrows wrap around', () => {
    stubMatchMedia();
    renderSlider({ infinite: true });
    fireEvent.click(prev());
    expect(activeIndex()).toBe(2);
    fireEvent.click(next());
    expect(activeIndex()).toBe(0);
  });

  it('dots go to a slide and mark the current one', () => {
    stubMatchMedia();
    renderSlider();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la diapositiva 3' }));
    expect(activeIndex()).toBe(2);
    expect(
      screen.getByRole('button', { name: 'Ir a la diapositiva 3' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('clamps the active slide during render when slides shrink', () => {
    stubMatchMedia();
    const { rerenderWith } = renderSlider();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la diapositiva 3' }));
    rerenderWith({ slides: ['Uno', 'Dos'] });
    expect(activeIndex()).toBe(1);
    expect(slides().filter((slide) => !slide.hasAttribute('inert'))).toHaveLength(1);
  });

  it('autoplays with infinite wraparound', () => {
    stubMatchMedia();
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 2000 });
    advance(2000);
    expect(activeIndex()).toBe(1);
    advance(4000);
    expect(activeIndex()).toBe(0);
  });

  it('stops autoplay at the last slide when not infinite', () => {
    stubMatchMedia();
    renderSlider({ autoplay: true, autoplaySpeed: 1000 });
    advance(2000);
    expect(activeIndex()).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByRole('button', { name: 'Pausar carrusel' })).toBeNull();
  });

  it.each([
    ['zero', 0],
    ['negative', -500],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('does not autoplay with a %s speed', (_, speed) => {
    stubMatchMedia();
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: speed });
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(activeIndex()).toBe(0);
  });

  it('enforces a 1000 ms minimum autoplay speed', () => {
    stubMatchMedia();
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 10 });
    advance(500);
    expect(activeIndex()).toBe(0);
    advance(500);
    expect(activeIndex()).toBe(1);
  });

  it('pauses autoplay on hover and focus, resumes after', () => {
    stubMatchMedia();
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 1000 });
    const region = screen.getByRole('region', { name: 'Promociones' });
    fireEvent.mouseEnter(region);
    advance(3000);
    expect(activeIndex()).toBe(0);
    fireEvent.mouseLeave(region);
    fireEvent.focus(next());
    advance(3000);
    expect(activeIndex()).toBe(0);
    fireEvent.blur(next(), { relatedTarget: null });
    advance(1000);
    expect(activeIndex()).toBe(1);
  });

  it('the pause button toggles autoplay', () => {
    stubMatchMedia();
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 1000, showArrows: false });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar carrusel' }));
    // Clicking focuses nothing in jsdom; blur keeps the pause the only reason to stop.
    advance(3000);
    expect(activeIndex()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar carrusel' }));
    advance(1000);
    expect(activeIndex()).toBe(1);
  });

  it('never autoplays with reduced motion and stops when it turns on', () => {
    const media = stubMatchMedia({ reduced: true });
    renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 1000 });
    advance(3000);
    expect(activeIndex()).toBe(0);
    expect(screen.queryByRole('button', { name: 'Pausar carrusel' })).toBeNull();
    media.change(false);
    advance(1000);
    expect(activeIndex()).toBe(1);
    media.change(true);
    advance(3000);
    expect(activeIndex()).toBe(1);
  });

  it('falls back to addListener/removeListener on legacy MediaQueryList', () => {
    const media = stubMatchMedia({ reduced: true, legacy: true });
    const { unmount } = renderSlider({ autoplay: true, infinite: true, autoplaySpeed: 1000 });
    expect(media.addListener).toHaveBeenCalledTimes(1);
    media.change(false);
    advance(1000);
    expect(activeIndex()).toBe(1);
    unmount();
    expect(media.removeListener).toHaveBeenCalledTimes(1);
    expect(media.listeners.size).toBe(0);
  });
});
