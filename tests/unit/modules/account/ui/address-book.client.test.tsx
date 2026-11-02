// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerAddress } from '@/modules/address/application/ports';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import { AddressBook } from '@/modules/account/ui/address-book.client';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';

const actions = vi.hoisted(() => ({
  listAddressesAction: vi.fn(),
  deleteAddressAction: vi.fn(),
}));
vi.mock('@/modules/address/ui/address-actions', () => actions);

const redirect = vi.hoisted(() => vi.fn());
vi.mock('@/modules/account/ui/browser-redirect', () => ({ redirectBrowser: redirect }));

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const PROFILE = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: null,
  photoUrl: null,
};

const address = (overrides: Partial<CustomerAddress> = {}): CustomerAddress => ({
  id: 1,
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  street: ['Av. Revolución', 'Piso 2'],
  city: 'Tijuana',
  postcode: '22010',
  countryCode: 'MX',
  region: { name: 'Baja California', code: 'BCN', id: 1 },
  telephone: '6643119682',
  defaultShipping: false,
  defaultBilling: false,
  customFields: {
    custom_field_1: 'García',
    custom_field_2: '123',
    custom_field_3: 'Zona Centro',
    custom_field_4: 'Tijuana',
  },
  ...overrides,
});

const HOME = address({ id: 1, defaultShipping: true });
const WORK = address({
  id: 2,
  firstName: 'Luis',
  lastName: 'Soto',
  street: ['Calle 5'],
  city: 'Mexicali',
});

function renderBook() {
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
  return render(
    <AccountProfileProvider profile={PROFILE} token="a.b.c">
      <AddressBook />
    </AccountProfileProvider>,
  );
}

const card = (name: string) => screen.getByRole('listitem', { name });

beforeEach(() => {
  actions.listAddressesAction.mockReset();
  actions.deleteAddressAction.mockReset();
  redirect.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe('AddressBook', () => {
  it('lists the addresses with the default shipping address first and the add button', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [WORK, HOME] });
    renderBook();

    expect(await screen.findByRole('heading', { level: 1, name: 'MIS DIRECCIONES' })).toBeTruthy();
    expect(actions.listAddressesAction).toHaveBeenCalledWith({ token: 'a.b.c' });
    const cards = screen.getAllByRole('listitem');
    expect(cards.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Ana Pérez',
      'Luis Soto',
    ]);
    expect(screen.getByRole('link', { name: 'Agregar dirección' }).getAttribute('href')).toBe(
      '/my-account/address-book/new',
    );
  });

  it('shows the address lines in the legacy order and the Principal badge on the default only', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [HOME, WORK] });
    renderBook();
    await screen.findByText('Av. Revolución');

    const home = within(card('Ana Pérez'));
    expect(home.getByText('Principal')).toBeTruthy();
    for (const line of [
      'Av. Revolución',
      'Piso 2',
      '123',
      'Zona Centro',
      'Tijuana',
      'Tijuana, Baja California',
      '22010',
      '6643119682',
    ]) {
      expect(home.getAllByText(line).length).toBeGreaterThan(0);
    }
    expect(within(card('Luis Soto')).queryByText('Principal')).toBeNull();
  });

  it('links each card to its edit page and hides the delete button on the default address', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [HOME, WORK] });
    renderBook();
    await screen.findByText('Av. Revolución');

    expect(
      within(card('Ana Pérez'))
        .getByRole('link', { name: 'Editar dirección de Ana Pérez' })
        .getAttribute('href'),
    ).toBe('/my-account/address-book/edit/1');
    expect(within(card('Ana Pérez')).queryByRole('button', { name: /Eliminar/ })).toBeNull();
    expect(
      within(card('Luis Soto')).getByRole('button', { name: 'Eliminar dirección de Luis Soto' }),
    ).toBeTruthy();
  });

  it('asks to confirm, can be cancelled, and deletes then drops the card', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [HOME, WORK] });
    actions.deleteAddressAction.mockResolvedValue({ status: 'saved' });
    renderBook();
    await screen.findByText('Calle 5');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar dirección de Luis Soto' }));
    fireEvent.click(within(card('Luis Soto')).getByRole('button', { name: 'Cancelar' }));
    expect(actions.deleteAddressAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar dirección de Luis Soto' }));
    fireEvent.click(within(card('Luis Soto')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.queryByText('Calle 5')).toBeNull());
    expect(actions.deleteAddressAction).toHaveBeenCalledWith({ token: 'a.b.c', id: 2 });
    expect(screen.getByText('Av. Revolución')).toBeTruthy();
  });

  it('tells the shopper when the delete fails and keeps the card', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [HOME, WORK] });
    actions.deleteAddressAction.mockResolvedValue({ status: 'failed' });
    renderBook();
    await screen.findByText('Calle 5');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar dirección de Luis Soto' }));
    fireEvent.click(within(card('Luis Soto')).getByRole('button', { name: 'Eliminar' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos eliminar la dirección. Inténtalo de nuevo.',
    );
    expect(screen.getByText('Calle 5')).toBeTruthy();
  });

  it('shows the legacy empty state with the add button', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [] });
    renderBook();

    expect(await screen.findByText('¡Aún no tienes direcciones guardadas!')).toBeTruthy();
    expect(
      screen.getByText(
        'Registra aquí tus direcciones de envío y facturación favoritas. De esta forma, tus próximas compras serán mucho más rápidas y sencillas.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Agregar dirección' }).length).toBeGreaterThan(0);
  });

  it('shows the legacy error when the list cannot be read', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'failed' });
    renderBook();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.',
    );
  });

  it('drops a token Magento rejects and sends the shopper to sign in', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'not_authorized' });
    renderBook();

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith('/sign-in?from=%2Fmy-account%2Faddress-book'),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
