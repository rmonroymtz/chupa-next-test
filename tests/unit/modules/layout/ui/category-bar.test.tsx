// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { CategoryBar } from '@/modules/layout/ui/category-bar';

afterEach(cleanup);

const item = (label: string, children: MenuItem[] = []): MenuItem => ({
  id: label,
  label,
  categoryHref: `/${label.toLowerCase()}.html`,
  children,
});

describe('CategoryBar', () => {
  it('shows the Categorías dropdown, then one link per top-level category, from 1160', () => {
    render(<CategoryBar items={[item('Hogar', [item('Cocina')]), item('Herramientas')]} />);
    const nav = screen.getByRole('navigation', { name: 'Categorías principales' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Hogar', '/hogar.html'],
      ['Herramientas', '/herramientas.html'],
    ]);
    // Only the top level: subcategories stay in the dropdown.
    expect(within(nav).queryByRole('link', { name: 'Cocina' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Categorías' })).toBeTruthy();
    const bar = nav.closest('[data-slot="category-bar"]');
    expect(bar?.className).toContain('hidden');
    expect(bar?.className).toContain('desktop:block');
  });

  it('renders nothing without categories', () => {
    const { container } = render(<CategoryBar items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
