// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductSkeleton } from '@/modules/product/ui/product-skeleton';

afterEach(cleanup);

describe('ProductSkeleton', () => {
  it('sits on the page grid (1260 container, DS margins) like the loaded product page', () => {
    render(<ProductSkeleton />);
    const skeleton = screen.getByTestId('pdp-skeleton');
    expect(skeleton.className.split(' ')).toContain('container-padded');
    expect(skeleton.className).not.toMatch(/max-w-|\bpx-4\b/);
  });

  it('announces the loading state and hides the placeholder blocks', () => {
    render(<ProductSkeleton />);
    const skeleton = screen.getByTestId('pdp-skeleton');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.textContent).toContain('Cargando producto…');
    expect(skeleton.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
