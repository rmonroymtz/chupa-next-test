// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { DesktopCategoryNav, MobileCategoryMenu } from '@/modules/layout/ui/category-nav';
import { SiteHeader } from '@/modules/layout/ui/site-header';

afterEach(cleanup);

const item = (label: string, children: MenuItem[] = []): MenuItem => ({
  id: label,
  label,
  searchHref: `/search.html?query=${label}&store=amazon&page=1`,
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
  it('is the banner landmark with a home logo link, sign-in and the cart slot', () => {
    renderHeader();
    const banner = screen.getByRole('banner');

    const home = within(banner).getByRole('link', { name: 'Chupaprecios' });
    expect(home.getAttribute('href')).toBe('/');
    // Desktop pill and the entry inside the mobile drawer.
    const signIn = within(banner).getAllByRole('link', { name: 'Iniciar sesión' });
    expect(signIn.map((link) => link.getAttribute('href'))).toEqual(['/sign-in', '/sign-in']);
    const cart = within(banner).getByRole('link', { name: 'Carrito de compras' });
    expect(cart.getAttribute('href')).toBe('/cart');
    expect(cart.dataset.slot).toBe('cart-trigger');
  });

  it('has one GET search form to the legacy search page with the store tabs', () => {
    renderHeader();
    const search = screen.getByRole('search');

    expect(search.getAttribute('action')).toBe('/search.html');
    expect(search.getAttribute('method')).toBe('get');
    const query = within(search).getByRole('searchbox', { name: 'Buscar productos' });
    expect(query.getAttribute('name')).toBe('query');
    expect(query.hasAttribute('required')).toBe(true);
    const group = within(search).getByRole('group', { name: 'Tienda donde buscar' });
    const stores = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(stores.map((radio) => radio.value)).toEqual([
      'chupachoice',
      'amazon',
      'ebay',
      'target',
      'acme',
    ]);
    expect(stores.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual([
      'chupachoice',
    ]);
    expect(within(search).getByRole('radio', { name: 'eBay' })).toBeTruthy();
    expect(
      (search.querySelector('input[type="hidden"][name="page"]') as HTMLInputElement).value,
    ).toBe('1');
    expect(within(search).getByRole('button', { name: 'Buscar' })).toBeTruthy();
    expect(screen.getAllByRole('search')).toHaveLength(1);
  });

  it('desktop navigation: top level links to the search page, submenu to category pages', () => {
    render(<DesktopCategoryNav items={MENU} />);
    const nav = screen.getByRole('navigation', { name: 'Categorías' });

    expect(within(nav).getByRole('link', { name: 'hogar' }).getAttribute('href')).toBe(
      '/search.html?query=hogar&store=amazon&page=1',
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

  it('mobile navigation is a native disclosure that links every level to the search page', () => {
    render(<MobileCategoryMenu items={MENU} />);
    const toggle = screen.getByLabelText('Alternar panel de navegación');
    expect(toggle.tagName).toBe('SUMMARY');

    const nav = screen.getByRole('navigation', { name: 'Menú principal', hidden: true });
    const links = within(nav).getAllByRole('link', { hidden: true });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/search.html?query=hogar&store=amazon&page=1',
      '/search.html?query=cocina&store=amazon&page=1',
      '/search.html?query=juguetes&store=amazon&page=1',
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
