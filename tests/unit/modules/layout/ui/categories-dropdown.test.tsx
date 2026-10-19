// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { CategoriesDropdown } from '@/modules/layout/ui/categories-dropdown.client';

afterEach(cleanup);

const item = (label: string, children: MenuItem[] = []): MenuItem => ({
  id: label,
  label,
  categoryHref: `/${label}.html`,
  children,
});

const MENU = [
  item('hogar', [item('cocina', [item('sartenes')]), item('baño')]),
  item('juguetes', [item('peluches')]),
  item('libros'),
];

function renderDropdown(items: readonly MenuItem[] = MENU) {
  const view = render(
    <div>
      <CategoriesDropdown items={items} />
      <p>fuera</p>
    </div>,
  );
  const trigger = screen.queryByRole('button', { name: 'Categorías' });
  return { ...view, trigger };
}

function open() {
  const { trigger, ...rest } = renderDropdown();
  fireEvent.click(trigger!);
  const nav = screen.getByRole('navigation', { name: 'Categorías' });
  const rows = [...nav.querySelectorAll<HTMLAnchorElement>('[data-category-row]')];
  return { trigger: trigger!, nav, rows, ...rest };
}

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

describe('CategoriesDropdown', () => {
  it('is a disclosure button that toggles aria-expanded and its controlled panel', () => {
    const { trigger } = renderDropdown();
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(trigger!.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel!.hidden).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Categorías' })).toBeNull();

    fireEvent.click(trigger!);
    expect(trigger!.getAttribute('aria-expanded')).toBe('true');
    expect(panel!.hidden).toBe(false);
    // A disclosure of links, not an ARIA menu.
    expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();

    fireEvent.click(trigger!);
    expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    expect(panel!.hidden).toBe(true);
  });

  it('left panel lists the top-level categories linking to their category pages', () => {
    const { rows } = open();
    expect(rows.map((row) => row.textContent)).toEqual(['hogar', 'juguetes', 'libros']);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/hogar.html',
      '/juguetes.html',
      '/libros.html',
    ]);
  });

  it('right panel shows the children of the active category (first by default)', () => {
    open();
    expect(hrefOf('cocina')).toBe('/cocina.html');
    expect(hrefOf('baño')).toBe('/baño.html');
    expect(hrefOf('Ver todo en hogar')).toBe('/hogar.html');
    expect(screen.queryByRole('link', { name: 'peluches' })).toBeNull();
  });

  it('hover and focus switch the active category', () => {
    const { rows } = open();

    fireEvent.mouseEnter(rows[1]!);
    expect(hrefOf('peluches')).toBe('/peluches.html');
    expect(hrefOf('Ver todo en juguetes')).toBe('/juguetes.html');
    expect(screen.queryByRole('link', { name: 'cocina' })).toBeNull();

    fireEvent.focus(rows[2]!);
    expect(hrefOf('Ver todo en libros')).toBe('/libros.html');
    expect(screen.queryByRole('link', { name: 'peluches' })).toBeNull();
  });

  it('arrow keys move between the categories and into the active subcategories', () => {
    const { rows } = open();
    rows[0]!.focus();

    fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    expect(hrefOf('peluches')).toBe('/peluches.html');

    fireEvent.keyDown(rows[1]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2]!, { key: 'Home' });
    expect(document.activeElement).toBe(rows[0]);

    fireEvent.keyDown(rows[0]!, { key: 'ArrowRight' });
    // The first link of the right panel: the active category title.
    expect(rows).not.toContain(document.activeElement);
    expect(document.activeElement?.tagName).toBe('A');
    expect(document.activeElement?.getAttribute('href')).toBe('/hogar.html');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(rows[0]);
  });

  it('Escape closes the panel and returns focus to the button', () => {
    const { trigger, rows } = open();
    rows[1]!.focus();

    fireEvent.keyDown(rows[1]!, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('a click outside closes the panel; a click inside does not', () => {
    const { trigger, rows } = open();

    fireEvent.pointerDown(rows[0]!);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(screen.getByText('fuera'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('focus leaving the dropdown closes it', () => {
    const { trigger, rows } = open();
    fireEvent.blur(rows[0]!, { relatedTarget: screen.getByText('fuera') });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('server-renders every category link while closed (crawlable)', () => {
    const { container } = renderDropdown();
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    for (const href of [
      '/hogar.html',
      '/cocina.html',
      '/baño.html',
      '/peluches.html',
      '/libros.html',
    ]) {
      expect(hrefs).toContain(href);
    }
  });

  it('renders nothing without categories', () => {
    const { container, trigger } = renderDropdown([]);
    expect(trigger).toBeNull();
    expect(container.querySelector('nav')).toBeNull();
  });
});
