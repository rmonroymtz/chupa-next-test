// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromoBarContent } from '@/modules/promo-bar/domain/promo-bar';
import { PromoBar } from '@/modules/promo-bar/ui/promo-bar';

/** matchMedia stub for `(prefers-reduced-motion: reduce)`. */
function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduced,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

const THREE: PromoBarContent = {
  interval: 1000,
  slides: [
    { highlight: 'Uno', message: 'primero', cta: { label: 'Ver uno', href: '/uno' } },
    { highlight: 'Dos', message: 'segundo' },
    { highlight: 'Tres', message: 'tercero' },
  ],
};

const region = () => screen.getByRole('region', { name: 'Promociones' });

/** Text of the slides exposed to assistive technology (not aria-hidden). */
const exposedSlides = () =>
  Array.from(region().querySelectorAll('[data-slot="promo-slide"]:not([aria-hidden="true"])')).map(
    (slide) => slide.textContent,
  );

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PromoBar', () => {
  it('server-renders the first slide as the only one exposed, inside a labelled region', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PromoBar />);

    const section = container.querySelector('section[aria-label="Promociones"]');
    expect(section).not.toBeNull();
    const slides = Array.from(section!.querySelectorAll('[data-slot="promo-slide"]'));
    expect(slides).toHaveLength(4);
    expect(slides[0]!.textContent).toBe(
      'Envío gratis en compra mínima de $1,500*. *Promoción válida sólo para México.',
    );
    expect(slides[0]!.hasAttribute('aria-hidden')).toBe(false);
    for (const hidden of slides.slice(1)) {
      expect(hidden.getAttribute('aria-hidden')).toBe('true');
      expect(hidden.hasAttribute('inert')).toBe(true);
    }
  });

  it('renders the bold lead, the white DS bar and the caption type', () => {
    render(<PromoBar />);
    const bar = region();
    expect(bar.className).toContain('bg-ds-surface');
    expect(bar.className).toContain('text-ds-text');
    expect(bar.className).toContain('text-caption');
    expect(within(bar).getByText('Envío gratis').tagName).toBe('STRONG');
  });

  it('does not announce the automatic rotation', () => {
    render(<PromoBar content={THREE} />);
    expect(region().querySelector('[aria-live]')?.getAttribute('aria-live')).toBe('off');
  });

  it('rotates to the next slide every interval and wraps around', () => {
    render(<PromoBar content={THREE} />);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
    tick(999);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
    tick(1);
    expect(exposedSlides()).toEqual(['Dos segundo']);
    tick(1000);
    expect(exposedSlides()).toEqual(['Tres tercero']);
    tick(1000);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
  });

  it('pauses while hovered and resumes on leave', () => {
    render(<PromoBar content={THREE} />);
    const slides = region().querySelector('[aria-live]')!;
    fireEvent.mouseEnter(slides);
    tick(5000);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
    fireEvent.mouseLeave(slides);
    tick(1000);
    expect(exposedSlides()).toEqual(['Dos segundo']);
  });

  it('pauses while keyboard focus is inside and resumes when it leaves', () => {
    render(<PromoBar content={THREE} />);
    const link = within(region()).getByRole('link', { name: 'Ver uno' });
    act(() => link.focus());
    tick(5000);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
    act(() => link.blur());
    tick(1000);
    expect(exposedSlides()).toEqual(['Dos segundo']);
  });

  it('keeps only the active slide reachable by keyboard', () => {
    render(<PromoBar content={THREE} />);
    tick(1000);
    expect(within(region()).queryByRole('link', { name: 'Ver uno' })).toBeNull();
  });

  it('does not rotate when the user prefers reduced motion', () => {
    stubReducedMotion(true);
    render(<PromoBar content={THREE} />);
    expect(vi.getTimerCount()).toBe(0);
    tick(10_000);
    expect(exposedSlides()).toEqual(['Uno primeroVer uno']);
  });

  it('starts no timer for a single slide', () => {
    render(<PromoBar content={{ interval: 1000, slides: [{ highlight: 'Solo' }] }} />);
    expect(vi.getTimerCount()).toBe(0);
    expect(exposedSlides()).toEqual(['Solo']);
  });

  it('skips empty slides and renders nothing without content', () => {
    const { rerender } = render(
      <PromoBar content={{ interval: 1000, slides: [{}, { message: 'Hola' }] }} />,
    );
    expect(exposedSlides()).toEqual(['Hola']);
    expect(region().querySelectorAll('[data-slot="promo-slide"]')).toHaveLength(1);
    rerender(<PromoBar content={{ interval: 1000, slides: [{}] }} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('exposes the Kueski Pay logo only once its slide is active', () => {
    render(<PromoBar />);
    expect(within(region()).queryByRole('img', { name: 'Kueski Pay' })).toBeNull();
    for (let step = 0; step < 3; step += 1) tick(5000);
    expect(within(region()).getByRole('img', { name: 'Kueski Pay' })).toBeDefined();
    expect(exposedSlides()).toEqual([
      '¡Ahora paga con! Compra hoy y paga después, sin necesidad de tarjeta de crédito.',
    ]);
  });
});
