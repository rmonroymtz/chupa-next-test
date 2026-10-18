// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Icon, iconNames } from '@/shared/ui/icon';

afterEach(cleanup);

describe('Icon', () => {
  it('ships the 41 V3 board glyphs plus the on-demand and brand extras', () => {
    expect(iconNames.length).toBe(50);
    expect(iconNames).toEqual(expect.arrayContaining(['search', 'menu', 'chevron-down', 'check']));
    expect(iconNames.slice(-2)).toEqual(['facebook', 'instagram']);
  });

  it('brand glyphs fill their solid parts themselves', () => {
    const { container } = render(<Icon name="facebook" />);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
  });

  it('is decorative by default', () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.hasAttribute('role')).toBe(false);
    expect(svg?.innerHTML).toContain('circle');
  });

  it('is an image with an accessible name when titled', () => {
    render(<Icon name="truck" title="Envío gratis" />);
    const svg = screen.getByRole('img', { name: 'Envío gratis' });
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('applies size, stroke width and className', () => {
    const { container } = render(
      <Icon name="x" size={16} strokeWidth={2} className="text-ds-cta" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
    expect(svg?.getAttribute('stroke-width')).toBe('2');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('class')).toBe('text-ds-cta');
  });
});
