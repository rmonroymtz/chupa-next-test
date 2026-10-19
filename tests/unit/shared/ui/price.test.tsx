// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatPrice, Price } from '@/shared/ui/price';

afterEach(cleanup);

const offer = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-price="offer"]');
const compareAt = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-price="compare-at"]');

describe('formatPrice', () => {
  it('formats with es-MX conventions and the currency minor units', () => {
    expect(formatPrice(1299, 'MXN')).toBe('$1,299.00');
    expect(formatPrice(899.5, 'MXN')).toBe('$899.50');
  });

  it('still shows the amount for an invalid currency code', () => {
    expect(formatPrice(10, 'NOT-A-CODE')).toBe('10.00 NOT-A-CODE');
  });
});

describe('Price (PWA Gallery card price)', () => {
  it('shows the offer price in the brand anchor red, bold, centered', () => {
    const { container } = render(<Price amount={1299} currency="MXN" />);

    expect(offer(container)?.textContent).toBe('$1,299.00');
    const root = container.querySelector<HTMLElement>('[data-slot="price"]');
    expect(root?.className).toContain('text-ds-accent');
    expect(root?.className).toContain('text-lg');
    expect(root?.className).toContain('font-bold');
    expect(offer(container)?.className).toContain('justify-center');
    expect(offer(container)?.className).toContain('min-h-[28px]');
  });

  it('strikes the compare-at price in #AAAAAA with an accessible label, only when higher', () => {
    const { container } = render(<Price amount={899.5} currency="MXN" compareAt={1299} />);

    const old = compareAt(container);
    expect(old?.tagName).toBe('S');
    expect(old?.textContent).toBe('$1,299.00');
    expect(old?.className).toContain('text-ds-text-tertiary');
    expect(old?.className).toContain('line-through');
    expect(old?.className).toContain('font-light');
    expect(screen.getByText('Antes:').className).toContain('sr-only');
  });

  it.each([
    ['no compare-at price', null],
    ['an equal compare-at price', 1299],
    ['a lower compare-at price', 1000],
  ])('shows no compare-at price with %s', (_, previous) => {
    const { container } = render(<Price amount={1299} currency="MXN" compareAt={previous} />);

    expect(compareAt(container)).toBeNull();
    expect(screen.queryByText('Antes:')).toBeNull();
  });

  it('uses the PWA recommendation slider sizes in the slider variant', () => {
    const { container } = render(
      <Price amount={100} currency="MXN" compareAt={150} variant="slider" />,
    );

    expect(offer(container)?.className).toContain('text-[15px]');
    expect(offer(container)?.className).toContain('text-ds-accent');
    expect(compareAt(container)?.className).toContain('text-[11px]');
    expect(compareAt(container)?.className).toContain('text-[#888]');
  });
});
