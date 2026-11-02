import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  regions: vi.fn(),
  sepomex: vi.fn(),
  formConfig: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/address/infrastructure/address.composition', () => ({
  getAddressService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const actions = await import('@/modules/address/ui/address-actions');

const ADDRESS = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  street: ['Av. Revolución'],
  city: 'Tijuana',
  postcode: '22010',
  countryId: 'MX',
  region: { name: 'Baja California', id: 1 },
  telephone: '6643119682',
  customFields: { custom_field_2: 'S/N' },
};

beforeEach(() => {
  Object.values(service).forEach((mock) => mock.mockReset());
  warn.mockReset();
});

describe('address actions', () => {
  it('pass the validated input to the service', async () => {
    service.list.mockResolvedValue({ status: 'ok', addresses: [] });
    service.create.mockResolvedValue({ status: 'saved' });
    service.update.mockResolvedValue({ status: 'saved' });
    service.remove.mockResolvedValue({ status: 'saved' });
    service.regions.mockResolvedValue({ status: 'ok', regions: [] });
    service.sepomex.mockResolvedValue({ status: 'ok', municipio: null });
    service.formConfig.mockResolvedValue({ fields: [], streetLines: 2, googleApiKey: null });

    expect(await actions.listAddressesAction({ token: 'a.b.c' })).toEqual({
      status: 'ok',
      addresses: [],
    });
    expect(await actions.createAddressAction({ token: 'a.b.c', address: ADDRESS })).toEqual({
      status: 'saved',
    });
    expect(await actions.updateAddressAction({ token: 'a.b.c', id: 7, address: ADDRESS })).toEqual({
      status: 'saved',
    });
    expect(await actions.deleteAddressAction({ token: 'a.b.c', id: 7 })).toEqual({
      status: 'saved',
    });
    expect(await actions.getRegionsAction({ countryCode: 'MX' })).toEqual({
      status: 'ok',
      regions: [],
    });
    expect(await actions.getSepomexAction({ postalCode: '22010' })).toEqual({
      status: 'ok',
      municipio: null,
    });
    expect(await actions.getAddressFormConfigAction()).toEqual({
      fields: [],
      streetLines: 2,
      googleApiKey: null,
    });
    expect(service.update).toHaveBeenCalledWith({ token: 'a.b.c', id: 7, address: ADDRESS });
    expect(service.remove).toHaveBeenCalledWith({ token: 'a.b.c', id: 7 });
  });

  it('reject invalid input without reaching Magento and log only the action name', async () => {
    expect(await actions.listAddressesAction({ token: '' })).toEqual({ status: 'failed' });
    expect(
      await actions.createAddressAction({ token: 'a.b.c', address: { ...ADDRESS, street: [] } }),
    ).toEqual({
      status: 'failed',
    });
    expect(await actions.deleteAddressAction({ token: 'a.b.c', id: 0 })).toEqual({
      status: 'failed',
    });
    expect(await actions.getSepomexAction({ postalCode: 'x' })).toEqual({ status: 'failed' });
    expect(service.list).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
    expect(service.sepomex).not.toHaveBeenCalled();
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      { action: 'list_addresses' },
      { action: 'create_address' },
      { action: 'delete_address' },
      { action: 'get_sepomex' },
    ]);
  });

  it('answer failed when the service cannot be built, and defaults for the form config', async () => {
    service.list.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    service.formConfig.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    expect(await actions.listAddressesAction({ token: 'a.b.c' })).toEqual({ status: 'failed' });
    const config = await actions.getAddressFormConfigAction();
    expect(config.streetLines).toBe(2);
    expect(config.googleApiKey).toBeNull();
    expect(config.fields.length).toBeGreaterThan(0);
  });
});
