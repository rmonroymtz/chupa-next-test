// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryNavScroller } from '@/modules/layout/ui/category-nav-scroller.client';

afterEach(cleanup);

const LEFT = 'Desplazar categorías a la izquierda';
const RIGHT = 'Desplazar categorías a la derecha';

function renderScroller() {
  render(
    <CategoryNavScroller>
      <ul data-testid="list">
        <li>
          <a href="/hogar.html">hogar</a>
        </li>
      </ul>
    </CategoryNavScroller>,
  );
  const scroller = screen.getByTestId('list').parentElement as HTMLElement;
  return scroller;
}

/** jsdom has no layout: fake the scroll metrics and notify the component. */
function layout(
  scroller: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(scroller, 'scrollWidth', {
    configurable: true,
    value: metrics.scrollWidth,
  });
  Object.defineProperty(scroller, 'clientWidth', {
    configurable: true,
    value: metrics.clientWidth,
  });
  Object.defineProperty(scroller, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: metrics.scrollLeft,
  });
  act(() => {
    fireEvent.scroll(scroller);
  });
}

const arrow = (name: string) => screen.queryByRole('button', { name });

describe('CategoryNavScroller', () => {
  it('keeps the server-rendered list inside a horizontal scroll container', () => {
    const scroller = renderScroller();
    expect(scroller.className).toContain('overflow-x-auto');
    expect(screen.getByRole('link', { name: 'hogar' }).getAttribute('href')).toBe('/hogar.html');
  });

  it('shows no arrows when the list fits', () => {
    const scroller = renderScroller();
    layout(scroller, { scrollWidth: 800, clientWidth: 800, scrollLeft: 0 });
    expect(arrow(LEFT)).toBeNull();
    expect(arrow(RIGHT)).toBeNull();
  });

  it('at the start only offers scrolling to the right', () => {
    const scroller = renderScroller();
    layout(scroller, { scrollWidth: 2000, clientWidth: 800, scrollLeft: 0 });
    expect(arrow(LEFT)).toBeNull();
    expect(arrow(RIGHT)).not.toBeNull();
  });

  it('in the middle offers both directions', () => {
    const scroller = renderScroller();
    layout(scroller, { scrollWidth: 2000, clientWidth: 800, scrollLeft: 600 });
    expect(arrow(LEFT)).not.toBeNull();
    expect(arrow(RIGHT)).not.toBeNull();
  });

  it('at the end only offers scrolling to the left (sub-pixel tolerant)', () => {
    const scroller = renderScroller();
    layout(scroller, { scrollWidth: 2000, clientWidth: 800, scrollLeft: 1199.5 });
    expect(arrow(LEFT)).not.toBeNull();
    expect(arrow(RIGHT)).toBeNull();
  });

  it('arrows scroll by most of the visible width in their direction', () => {
    const scroller = renderScroller();
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
    layout(scroller, { scrollWidth: 2000, clientWidth: 800, scrollLeft: 600 });

    fireEvent.click(arrow(RIGHT) as HTMLElement);
    fireEvent.click(arrow(LEFT) as HTMLElement);

    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 640 });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { left: -640 });
  });

  it('arrows are real buttons (keyboard operable) that do not submit forms', () => {
    const scroller = renderScroller();
    layout(scroller, { scrollWidth: 2000, clientWidth: 800, scrollLeft: 600 });
    for (const name of [LEFT, RIGHT]) {
      const button = arrow(name) as HTMLButtonElement;
      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
    }
  });
});
