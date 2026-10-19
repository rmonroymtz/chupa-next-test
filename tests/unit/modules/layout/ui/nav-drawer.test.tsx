// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { NavDrawer } from '@/modules/layout/ui/nav-drawer.client';

const item = (label: string, children: MenuItem[] = []): MenuItem => ({
  id: label,
  label,
  categoryHref: `/${label}.html`,
  children,
});

const MENU = [item('hogar', [item('cocina', [item('sartenes')]), item('baño')]), item('libros')];

// jsdom has no modal dialog: stand in for the platform (`showModal` opens
// the dialog modally, `close` closes it and fires `close`).
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

afterEach(() => {
  cleanup();
  showModal.mockClear();
  close.mockClear();
  document.body.style.overflow = '';
});

function renderDrawer(items: readonly MenuItem[] = MENU) {
  const view = render(<NavDrawer items={items} />);
  const trigger = screen.getByRole('button', { name: 'Categorías' });
  return { ...view, trigger };
}

function openDrawer(items: readonly MenuItem[] = MENU) {
  const { trigger, ...rest } = renderDrawer(items);
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Menú' });
  return { trigger, dialog, ...rest };
}

describe('NavDrawer', () => {
  it('the menu button opens a modal dialog and moves focus into it', () => {
    const { trigger } = renderDrawer();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Menú' });
    expect(dialog.tagName).toBe('DIALOG');
    // `showModal` = the platform focus trap (the rest of the page is inert).
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Cerrar menú' }),
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('the close button closes it, restores focus and the page scroll', () => {
    const { trigger, dialog } = openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar menú' }));

    expect(close).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape (the dialog cancel event) closes it and returns focus to the button', () => {
    const { trigger, dialog } = openDrawer();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('a click on the backdrop closes it', () => {
    const { dialog } = openDrawer();
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes and restores the page scroll when the viewport reaches 1160 (the desktop header)', () => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    const query = {
      matches: false,
      addEventListener: vi.fn((_: string, fn: (event: { matches: boolean }) => void) =>
        listeners.add(fn),
      ),
      removeEventListener: vi.fn((_: string, fn: (event: { matches: boolean }) => void) =>
        listeners.delete(fn),
      ),
    };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      const { trigger, dialog } = openDrawer();
      expect(matchMedia).toHaveBeenCalledWith('(min-width: 1160px)');
      expect(listeners.size).toBe(1);

      act(() => listeners.forEach((fn) => fn({ matches: false })));
      expect(dialog.hasAttribute('open')).toBe(true);

      act(() => listeners.forEach((fn) => fn({ matches: true })));
      expect(dialog.hasAttribute('open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.body.style.overflow).toBe('');
      // The listener only lives while the drawer is open.
      expect(listeners.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('restores the page scroll exactly once (no clobbering on a repeated close)', () => {
    document.body.style.overflow = 'scroll';
    const { container } = renderDrawer();
    const dialog = container.querySelector('dialog')!;
    // A close without an open leaves the page alone.
    fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('scroll');

    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú', hidden: true }));
    expect(document.body.style.overflow).toBe('scroll');

    // Someone else changes it afterwards; a second close must not undo that.
    document.body.style.overflow = 'auto';
    fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('auto');
  });

  it('drills down the category tree and back, linking every level to its page', () => {
    const { dialog } = openDrawer();
    const nav = within(dialog).getByRole('navigation', { name: 'Menú principal' });

    // Top level: branches open their subcategories, leaves are links.
    expect(within(nav).getByRole('link', { name: 'libros' }).getAttribute('href')).toBe(
      '/libros.html',
    );
    fireEvent.click(within(nav).getByRole('button', { name: 'hogar' }));

    expect(within(nav).getByRole('heading', { name: 'hogar' })).toBeTruthy();
    const back = within(nav).getByRole('button', { name: 'Volver' });
    expect(document.activeElement).toBe(back);
    expect(within(nav).getByRole('link', { name: 'Ver todo en hogar' }).getAttribute('href')).toBe(
      '/hogar.html',
    );
    expect(within(nav).getByRole('link', { name: 'baño' }).getAttribute('href')).toBe('/baño.html');
    expect(within(nav).queryByRole('link', { name: 'libros' })).toBeNull();

    fireEvent.click(within(nav).getByRole('button', { name: 'cocina' }));
    expect(within(nav).getByRole('link', { name: 'Ver todo en cocina' }).getAttribute('href')).toBe(
      '/cocina.html',
    );
    expect(within(nav).getByRole('link', { name: 'sartenes' }).getAttribute('href')).toBe(
      '/sartenes.html',
    );

    fireEvent.click(within(nav).getByRole('button', { name: 'Volver' }));
    expect(within(nav).getByRole('heading', { name: 'hogar' })).toBeTruthy();
    // Focus returns to the branch that was opened.
    expect(document.activeElement).toBe(within(nav).getByRole('button', { name: 'cocina' }));

    fireEvent.click(within(nav).getByRole('button', { name: 'Volver' }));
    expect(document.activeElement).toBe(within(nav).getByRole('button', { name: 'hogar' }));
  });

  it('reopens at the top level', () => {
    const { trigger, dialog } = openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'hogar' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar menú' }));
    fireEvent.click(trigger);
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'libros' })).toBeTruthy();
  });

  it('keeps the account entry and the home logo', () => {
    const { dialog } = openDrawer();
    expect(within(dialog).getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe(
      '/sign-in',
    );
    expect(within(dialog).getByRole('link', { name: 'Chupaprecios' }).getAttribute('href')).toBe(
      '/',
    );
  });

  it('server-renders every category link and sign-in while closed (crawlable)', () => {
    const { container } = renderDrawer();
    const hrefs = [...container.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/libros.html',
      '/hogar.html',
      '/baño.html',
      '/cocina.html',
      '/sartenes.html',
      '/sign-in',
    ]);
  });

  it('still offers sign-in when the menu is unavailable', () => {
    const { dialog } = openDrawer([]);
    const nav = within(dialog).getByRole('navigation', { name: 'Menú principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Iniciar sesión']);
  });
});
