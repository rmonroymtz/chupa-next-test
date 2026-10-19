// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { CategoriesDropdown } from '@/modules/layout/ui/categories-dropdown.client';
import { NavDrawer } from '@/modules/layout/ui/nav-drawer.client';
import { SiteHeader } from '@/modules/layout/ui/site-header';

vi.mock('@/modules/cart/ui/cart-actions', () => ({
  addToCartAction: vi.fn(),
  getCartCountAction: vi.fn(),
  getMiniCartAction: vi.fn(),
}));

afterEach(cleanup);

const item = (label: string, children: MenuItem[] = []): MenuItem => ({
  id: label,
  label,
  categoryHref: `/${label}.html`,
  children,
});

const MENU = [item('hogar', [item('cocina', [item('sartenes')])]), item('juguetes')];

function renderHeader(items: readonly MenuItem[] = MENU) {
  return render(
    <SiteHeader
      mobileNavigation={<NavDrawer items={items} />}
      desktopNavigation={<CategoriesDropdown items={items} />}
    />,
  );
}

describe('SiteHeader', () => {
  it('is the banner landmark with a home logo link, "Mi cuenta" and the cart slot', () => {
    renderHeader();
    const banner = screen.getByRole('banner');

    const home = within(banner).getByRole('link', { name: 'Chupaprecios' });
    expect(home.getAttribute('href')).toBe('/');
    expect(within(home).getByRole('img', { name: 'Chupaprecios' })).toBeTruthy();
    // DS actions: "Mi cuenta" keeps the sign-in target; the mobile drawer keeps its own entry.
    const account = within(banner).getByRole('link', { name: 'Mi cuenta' });
    expect(account.getAttribute('href')).toBe('/sign-in');
    // The drawer is a closed dialog until opened (hidden from the accessibility tree).
    const signIn = within(banner).getAllByRole('link', { name: 'Iniciar sesión', hidden: true });
    expect(signIn.map((link) => link.getAttribute('href'))).toEqual(['/sign-in']);
    // Mini-cart trigger (T7c): from 1160 a disclosure of the PWA dropdown, below a link to /cart.
    const cart = within(banner).getByRole('button', { name: /mini carrito/ });
    expect(cart.getAttribute('aria-expanded')).toBe('false');
    expect(cart.getAttribute('aria-haspopup')).toBeNull();
    expect(cart.dataset.slot).toBe('cart-trigger');
    expect(
      within(banner)
        .getByRole('link', { name: /^Carrito\. Tienes/ })
        .getAttribute('href'),
    ).toBe('/cart');
  });

  it('has one GET search form to the legacy search page', () => {
    renderHeader();
    const search = screen.getByRole('search') as HTMLFormElement;

    expect(search.getAttribute('action')).toBe('/search.html');
    expect(search.getAttribute('method')).toBe('get');
    const query = within(search).getByRole('searchbox', { name: 'Buscar productos' });
    expect(query.getAttribute('name')).toBe('query');
    expect(query.hasAttribute('required')).toBe(true);
    expect(query.getAttribute('placeholder')).toBe('Ingresa ASIN, SKU o Nombre del producto');
    expect(
      (search.querySelector('input[type="hidden"][name="page"]') as HTMLInputElement).value,
    ).toBe('1');
    const submit = within(search).getByRole('button', { name: 'Buscar' });
    expect(submit.getAttribute('type')).toBe('submit');
    expect(screen.getAllByRole('search')).toHaveLength(1);
  });

  it('store pills: a radio group in the top row that submits with the search form', () => {
    renderHeader();
    const banner = screen.getByRole('banner');
    const search = screen.getByRole('search') as HTMLFormElement;

    const group = within(banner).getByRole('radiogroup', { name: 'Tienda donde buscar' });
    // Row 1, outside the search row: associated through the `form` attribute.
    expect(search.contains(group)).toBe(false);
    const stores = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(stores.map((radio) => radio.value)).toEqual([
      'chupachoice',
      'amazon',
      'ebay',
      'target',
      'acme',
    ]);
    expect(stores.every((radio) => radio.name === 'store' && radio.form === search)).toBe(true);
    expect(stores.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual([
      'chupachoice',
    ]);
    expect([...new FormData(search)]).toEqual([
      ['store', 'chupachoice'],
      ['query', ''],
      ['page', '1'],
    ]);

    fireEvent.click(within(group).getByRole('radio', { name: 'eBay' }));
    expect(new FormData(search).getAll('store')).toEqual(['ebay']);
  });

  it('uses only the DS 768/1024 breakpoints in the header rows', () => {
    renderHeader();
    const banner = screen.getByRole('banner');
    const classes = [banner, ...banner.querySelectorAll('*')]
      .filter((element) => !element.closest('nav, dialog'))
      .flatMap((element) => (element.getAttribute('class') ?? '').split(/\s+/));
    expect(classes.filter((name) => /^(sm|xl|2xl):/.test(name))).toEqual([]);
  });

  it('the header logo is the DS wordmark (brand purple text, not black)', () => {
    const svg = readFileSync(join(process.cwd(), 'public/images/layout/logo.svg'), 'utf8');
    expect(svg).toContain('fill="#2a2031"');
    expect(svg).not.toContain('fill="#000"');
  });

  it('row 1: menu button, logo, the Categorías dropdown, then the store pills', () => {
    renderHeader();
    const banner = screen.getByRole('banner');
    const [drawerButton, dropdownButton] = within(banner).getAllByRole('button', {
      name: 'Categorías',
    });
    const logo = within(banner).getByRole('link', { name: 'Chupaprecios' });
    const pills = within(banner).getByRole('radiogroup', { name: 'Tienda donde buscar' });
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(drawerButton!.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dropdownButton!.hasAttribute('aria-controls')).toBe(true);
    expect(follows(drawerButton!, logo)).toBe(true);
    expect(follows(logo, dropdownButton!)).toBe(true);
    expect(follows(dropdownButton!, pills)).toBe(true);
    // Below 1024 the drawer, from 1024 the dropdown.
    expect(drawerButton!.closest('.lg\\:hidden')).not.toBeNull();
    expect(dropdownButton!.closest('.hidden.lg\\:block')).not.toBeNull();
  });

  it('no longer renders the horizontal megamenu or the <details> drawer', () => {
    renderHeader();
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('details, summary')).toBeNull();
    expect(screen.queryByLabelText(/Desplazar categorías/)).toBeNull();
    // The only "Categorías" navigation lives in the (closed) dropdown panel.
    const navs = within(banner).getAllByRole('navigation', { name: 'Categorías', hidden: true });
    expect(navs).toHaveLength(1);
    expect(navs[0]!.closest('[hidden]')).not.toBeNull();
  });
});
