// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerAddress } from '@/modules/address/application/ports';
import { DEFAULT_FIELDS, type FormField } from '@/modules/address/domain/address';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import { AddressForm } from '@/modules/account/ui/address-form.client';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';

const actions = vi.hoisted(() => ({
  getAddressFormConfigAction: vi.fn(),
  getRegionsAction: vi.fn(),
  listAddressesAction: vi.fn(),
  createAddressAction: vi.fn(),
  updateAddressAction: vi.fn(),
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
const REGIONS = [
  { id: 1, code: 'BCN', name: 'Baja California' },
  { id: 2, code: 'SON', name: 'Sonora' },
];
const SAVED: CustomerAddress = {
  id: 7,
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  street: ['Av. Revolución'],
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
};

function setup({
  addressId,
  fields = DEFAULT_FIELDS,
  regions = REGIONS,
}: { addressId?: number; fields?: readonly FormField[]; regions?: typeof REGIONS } = {}) {
  actions.getAddressFormConfigAction.mockResolvedValue({
    fields,
    streetLines: 2,
    googleApiKey: null,
  });
  actions.getRegionsAction.mockResolvedValue({ status: 'ok', regions });
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
  return render(
    <AccountProfileProvider profile={PROFILE} token="a.b.c">
      {addressId === undefined ? <AddressForm /> : <AddressForm addressId={addressId} />}
    </AccountProfileProvider>,
  );
}

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: RegExp, value: string) => fireEvent.change(field(name), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

async function fillValid(): Promise<void> {
  type(/^Nombre/, 'Ana');
  type(/^Apellido\*$/, 'Pérez');
  type(/^Teléfono/, '6643119682');
  type(/^Código postal/, '22010');
  fireEvent.change(field(/^Estado/), { target: { value: '1' } });
  type(/^Número/, '123');
  type(/^Colonia/, 'Zona Centro');
  type(/^Municipio/, 'Tijuana');
  type(/^Ciudad/, 'Tijuana');
  fireEvent.change(screen.getByPlaceholderText('Calle y número'), {
    target: { value: 'Av. Revolución' },
  });
}

beforeEach(() => {
  Object.values(actions).forEach((mock) => mock.mockReset());
  redirect.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe('AddressForm (new)', () => {
  it('shows the title, the Destinatario and Dirección groups and the Mexican country', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva dirección' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Destinatario' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Dirección' })).toBeTruthy();
    expect(screen.getByText('Ingresa tu dirección, después puedes ajustar los datos')).toBeTruthy();
    const country = field(/^País/);
    expect(country.value).toBe('México');
    expect(country.disabled).toBe(true);
    expect(screen.getByPlaceholderText('Calle y número')).toBeTruthy();
    expect(screen.getByPlaceholderText('Detalles adicionales')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe(
      '/my-account/address-book',
    );
  });

  it('renders only the fields of the config, in order', async () => {
    setup({
      fields: DEFAULT_FIELDS.filter((entry) =>
        ['firstname', 'street', 'city'].includes(entry.code),
      ),
    });
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    expect(screen.getByLabelText(/^Nombre/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Apellido$/)).toBeNull();
    expect(screen.queryByLabelText(/^Código postal/)).toBeNull();
    expect(screen.getByLabelText(/^Ciudad/)).toBeTruthy();
  });

  it('keeps only digits in the phone (12) and the postal code (5)', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    type(/^Teléfono/, '(664) 311-9682 12345');
    type(/^Código postal/, '22010-99');
    expect(field(/^Teléfono/).value).toBe('664311968212');
    expect(field(/^Código postal/).value).toBe('22010');
  });

  it('offers the Magento regions as a select, and a text input when there are none', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    const select = field(/^Estado/) as unknown as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Selecciona un estado', 'Baja California', 'Sonora']);
    cleanup();
    setup({ regions: [] });
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    expect(field(/^Estado/).tagName).toBe('INPUT');
  });

  it('turns "Sin número" into S/N and disables the number', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    const checkbox = screen.getByRole('checkbox', { name: 'Sin número' }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(field(/^Número/).value).toBe('S/N');
    expect(field(/^Número/).disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(field(/^Número/).value).toBe('');
    expect(field(/^Número/).disabled).toBe(false);
  });

  it('shows the required messages and sends nothing for an empty form', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    save();
    expect((await screen.findAllByText('Este campo es obligatorio')).length).toBeGreaterThanOrEqual(
      8,
    );
    expect(actions.createAddressAction).not.toHaveBeenCalled();
  });

  it('creates the address with the legacy payload and goes back to the address book', async () => {
    actions.createAddressAction.mockResolvedValue({ status: 'saved' });
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    await fillValid();
    save();

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/my-account/address-book'));
    expect(actions.createAddressAction).toHaveBeenCalledWith({
      token: 'a.b.c',
      address: {
        firstName: 'Ana',
        middleName: '',
        lastName: 'Pérez',
        street: ['Av. Revolución'],
        city: 'Tijuana',
        postcode: '22010',
        countryId: 'MX',
        region: { name: 'Baja California', id: 1 },
        telephone: '6643119682',
        customFields: {
          custom_field_1: '',
          custom_field_2: '123',
          custom_field_3: 'Zona Centro',
          custom_field_4: 'Tijuana',
        },
      },
    });
  });

  it('shows an error and keeps the data when Magento fails', async () => {
    actions.createAddressAction.mockResolvedValue({ status: 'failed' });
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    await fillValid();
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos guardar la dirección. Revisa los datos e inténtalo de nuevo.',
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(field(/^Nombre/).value).toBe('Ana');
  });

  it('drops a token Magento rejects and sends the shopper to sign in', async () => {
    actions.createAddressAction.mockResolvedValue({ status: 'not_authorized' });
    setup();
    await screen.findByRole('heading', { name: 'Nueva dirección' });
    await fillValid();
    save();

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith('/sign-in?from=%2Fmy-account%2Faddress-book%2Fnew'),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('AddressForm (edit)', () => {
  it('loads the address by id, prefills it and updates it keeping the middle name', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [SAVED] });
    actions.updateAddressAction.mockResolvedValue({ status: 'saved' });
    setup({ addressId: 7 });

    expect(await screen.findByRole('heading', { level: 1, name: 'Editar dirección' })).toBeTruthy();
    expect(actions.listAddressesAction).toHaveBeenCalledWith({ token: 'a.b.c' });
    expect(field(/^Nombre/).value).toBe('Ana');
    expect(field(/^Colonia/).value).toBe('Zona Centro');
    expect((field(/^Estado/) as unknown as HTMLSelectElement).value).toBe('1');

    type(/^Colonia/, 'Otra colonia');
    save();
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/my-account/address-book'));
    expect(actions.updateAddressAction).toHaveBeenCalledWith({
      token: 'a.b.c',
      id: 7,
      address: expect.objectContaining({
        middleName: 'María',
        customFields: expect.objectContaining({ custom_field_3: 'Otra colonia' }),
      }),
    });
    expect(actions.createAddressAction).not.toHaveBeenCalled();
  });

  it('checks "Sin número" for an address saved with S/N', async () => {
    actions.listAddressesAction.mockResolvedValue({
      status: 'ok',
      addresses: [{ ...SAVED, customFields: { ...SAVED.customFields, custom_field_2: 'S/N' } }],
    });
    setup({ addressId: 7 });
    await screen.findByRole('heading', { name: 'Editar dirección' });
    expect((screen.getByRole('checkbox', { name: 'Sin número' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(field(/^Número/).disabled).toBe(true);
  });

  it('says so when the address does not exist, with a way back', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'ok', addresses: [SAVED] });
    setup({ addressId: 99 });
    expect(await screen.findByText('No encontramos esta dirección.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Volver a mis direcciones' }).getAttribute('href'),
    ).toBe('/my-account/address-book');
  });

  it('shows the legacy error when the addresses cannot be read', async () => {
    actions.listAddressesAction.mockResolvedValue({ status: 'failed' });
    setup({ addressId: 7 });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.',
    );
  });
});
