// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = () => void;

/** A fake embla API: state the test sets, handlers it can fire. */
function fakeEmbla() {
  const handlers = new Map<string, Set<Handler>>();
  const state = { prev: false, next: true, selected: 0, snaps: [0, 0.5, 1] };
  return {
    state,
    emit(event: string) {
      act(() => handlers.get(event)?.forEach((handler) => handler()));
    },
    api: {
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      scrollTo: vi.fn(),
      canScrollPrev: () => state.prev,
      canScrollNext: () => state.next,
      selectedScrollSnap: () => state.selected,
      scrollSnapList: () => state.snaps,
      on: (event: string, handler: Handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)?.add(handler);
      },
      off: (event: string, handler: Handler) => {
        handlers.get(event)?.delete(handler);
      },
    },
  };
}

let embla = fakeEmbla();
const emblaRef = vi.fn();
/** Records the embla options (first argument); returns the ref and the fake API. */
const fakeUseEmbla = vi.fn<(options: unknown) => [typeof emblaRef, typeof embla.api | undefined]>(
  () => [emblaRef, embla.api],
);

vi.mock('embla-carousel-react', () => ({
  default: (options: unknown) => fakeUseEmbla(options),
}));

const { ProductCarousel } = await import('@/modules/recommendations/ui/product-carousel.client');

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function renderCarousel(itemCount = 8) {
  return render(
    <ProductCarousel itemCount={itemCount}>
      <ul data-testid="track">
        {Array.from({ length: itemCount }, (_, index) => (
          <li key={index}>Producto {index + 1}</li>
        ))}
      </ul>
    </ProductCarousel>,
  );
}

const prev = () => screen.getByRole('button', { name: 'Producto anterior' });
const next = () => screen.getByRole('button', { name: 'Siguiente producto' });
const dots = () => screen.queryAllByRole('button', { name: /^Página / });

beforeEach(() => {
  embla = fakeEmbla();
  fakeUseEmbla.mockClear();
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProductCarousel (PWA RandomSliders embla carousel)', () => {
  it('wraps the server-rendered track in an overflow-hidden embla viewport between the arrows', () => {
    renderCarousel();

    const track = screen.getByTestId('track');
    const viewport = track.parentElement;
    expect(viewport?.dataset.carouselViewport).toBeDefined();
    expect(viewport?.className.split(' ')).toContain('overflow-hidden');
    expect(emblaRef).toHaveBeenCalledWith(viewport);
    expect(prev().getAttribute('type')).toBe('button');
    expect(next().getAttribute('type')).toBe('button');
    expect(prev().compareDocumentPosition(viewport as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(next().compareDocumentPosition(viewport as Node)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it('uses the PWA useCarousel options and loops only with more cards than fit (5)', () => {
    renderCarousel(6);
    expect(fakeUseEmbla).toHaveBeenLastCalledWith({
      align: 'start',
      slidesToScroll: 'auto',
      containScroll: 'trimSnaps',
      loop: true,
      breakpoints: {
        '(max-width: 640px)': { slidesToScroll: 2 },
        '(min-width: 641px) and (max-width: 1024px)': { slidesToScroll: 3 },
      },
    });
    cleanup();

    renderCarousel(5);
    expect(fakeUseEmbla).toHaveBeenLastCalledWith(expect.objectContaining({ loop: false }));
  });

  it('scrolls back and forward with the arrows', () => {
    embla.state.prev = true;
    renderCarousel();

    fireEvent.click(prev());
    fireEvent.click(next());

    expect(embla.api.scrollPrev).toHaveBeenCalledTimes(1);
    expect(embla.api.scrollNext).toHaveBeenCalledTimes(1);
  });

  it('disables the arrows from canScrollPrev / canScrollNext and follows selections', () => {
    renderCarousel();
    expect(prev()).toHaveProperty('disabled', true);
    expect(next()).toHaveProperty('disabled', false);

    embla.state.prev = true;
    embla.state.next = false;
    embla.emit('select');

    expect(prev()).toHaveProperty('disabled', false);
    expect(next()).toHaveProperty('disabled', true);
  });

  it('shows one dot per scroll snap, marks the selected one and scrolls to a page on click', () => {
    renderCarousel();

    expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Página 1 de 3',
      'Página 2 de 3',
      'Página 3 de 3',
    ]);
    expect(dots().map((dot) => dot.dataset.active)).toEqual(['true', 'false', 'false']);

    fireEvent.click(dots()[2] as HTMLElement);
    expect(embla.api.scrollTo).toHaveBeenCalledWith(2, false);

    embla.state.selected = 2;
    embla.emit('select');
    expect(dots().map((dot) => dot.dataset.active)).toEqual(['false', 'false', 'true']);
  });

  it('recounts the dots when embla re-initializes (breakpoint change) and hides a single page', () => {
    renderCarousel();
    expect(dots()).toHaveLength(3);

    embla.state.snaps = [0];
    embla.emit('reInit');

    expect(dots()).toHaveLength(0);
  });

  it('jumps instead of animating when the visitor prefers reduced motion', () => {
    stubReducedMotion(true);
    embla.state.prev = true;
    renderCarousel();

    fireEvent.click(prev());
    fireEvent.click(next());
    fireEvent.click(dots()[1] as HTMLElement);

    expect(embla.api.scrollPrev).toHaveBeenCalledWith(true);
    expect(embla.api.scrollNext).toHaveBeenCalledWith(true);
    expect(embla.api.scrollTo).toHaveBeenCalledWith(1, true);
  });

  it('renders on the server with both arrows disabled and no dots until embla starts', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    fakeUseEmbla.mockImplementationOnce(() => [emblaRef, undefined]);
    document.body.innerHTML = renderToStaticMarkup(
      <ProductCarousel itemCount={8}>
        <ul>
          <li>Producto 1</li>
        </ul>
      </ProductCarousel>,
    );

    expect(prev()).toHaveProperty('disabled', true);
    expect(next()).toHaveProperty('disabled', true);
    expect(dots()).toHaveLength(0);
    expect(screen.getByText('Producto 1')).toBeDefined();
    document.body.innerHTML = '';
  });
});
