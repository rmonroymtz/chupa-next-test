// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Rating } from '@/shared/ui/rating';

afterEach(cleanup);

describe('Rating', () => {
  it('shows five stars filled up to the value, with an accessible label', () => {
    render(<Rating value={4.4} />);

    const stars = screen.getByRole('img', { name: 'Calificación: 4.4 de 5 estrellas' });
    expect(stars.querySelectorAll('svg')).toHaveLength(10);
    expect(stars.querySelector<HTMLElement>('[data-rating-fill]')?.style.width).toBe('88%');
  });

  it('uses the PWA Gallery ReviewStars size (20px) by default and 12px in the slider', () => {
    const { container, rerender } = render(<Rating value={3} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('20');

    rerender(<Rating value={3} variant="slider" />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('12');
  });

  it('caps the value at five stars', () => {
    render(<Rating value={7} />);

    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Calificación: 5.0 de 5 estrellas',
    );
  });

  it('renders nothing without a rating (PWA ReviewStars returns null for 0)', () => {
    const { container } = render(<Rating value={0} />);

    expect(container.innerHTML).toBe('');
  });
});
