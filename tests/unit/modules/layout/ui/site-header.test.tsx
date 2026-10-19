// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { DesktopCategoryNav, MobileCategoryMenu } from '@/modules/layout/ui/category-nav';
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
      mobileNavigation={<MobileCategoryMenu items={items} />}
      desktopNavigation={<DesktopCategoryNav items={items} />}
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
    const signIn = within(banner).getAllByRole('link', { name: 'Iniciar sesión' });
    expect(signIn.map((link) => link.getAttribute('href'))).toEqual(['/sign-in']);
    // Mini-cart trigger (T8): opens a dialog linking to the PWA cart and checkout.
    const cart = within(banner).getByRole('button', { name: /mini carrito/ });
    expect(cart.getAttribute('aria-haspopup')).toBe('dialog');
    expect(cart.dataset.slot).toBe('cart-trigger');
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
      .filter((element) => !element.closest('nav, details'))
      .flatMap((element) => (element.getAttribute('class') ?? '').split(/\s+/));
    expect(classes.filter((name) => /^(sm|xl|2xl):/.test(name))).toEqual([]);
  });

  it('the header logo is the DS wordmark (brand purple text, not black)', () => {
    const svg = readFileSync(join(process.cwd(), 'public/images/layout/logo.svg'), 'utf8');
    expect(svg).toContain('fill="#2a2031"');
    expect(svg).not.toContain('fill="#000"');
  });

  it('desktop navigation: every level links to its category page', () => {
    render(<DesktopCategoryNav items={MENU} />);
    const nav = screen.getByRole('navigation', { name: 'Categorías' });

    expect(within(nav).getByRole('link', { name: 'hogar' }).getAttribute('href')).toBe(
      '/hogar.html',
    );
    expect(within(nav).getByRole('link', { name: 'cocina' }).getAttribute('href')).toBe(
      '/cocina.html',
    );
    expect(within(nav).getByRole('link', { name: 'sartenes' }).getAttribute('href')).toBe(
      '/sartenes.html',
    );
  });

  it('without categories keeps the reserved bar instead of an empty navigation', () => {
    const { container } = render(<DesktopCategoryNav items={[]} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild?.className).toContain('h-12');
  });

  it('mobile navigation is a native disclosure that links every level to its category page', () => {
    render(<MobileCategoryMenu items={MENU} />);
    const toggle = screen.getByLabelText('Alternar panel de navegación');
    expect(toggle.tagName).toBe('SUMMARY');

    const nav = screen.getByRole('navigation', { name: 'Menú principal', hidden: true });
    const links = within(nav).getAllByRole('link', { hidden: true });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/hogar.html',
      '/cocina.html',
      '/juguetes.html',
      '/sign-in',
    ]);
  });

  it('mobile navigation still offers sign-in when the menu is unavailable', () => {
    render(<MobileCategoryMenu items={[]} />);
    const nav = screen.getByRole('navigation', { name: 'Menú principal', hidden: true });
    expect(
      within(nav)
        .getAllByRole('link', { hidden: true })
        .map((link) => link.textContent),
    ).toEqual(['Iniciar sesión']);
  });
});
