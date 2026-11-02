import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { AddressGatewayError, type AddressInput } from '@/modules/address/application/ports';
import { createMagentoAddressGateway } from '@/modules/address/infrastructure/magento-address-gateway';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const TOKEN = 'secret.jwt.token';
const server = setupMswServer();

interface Captured {
  authorization: string | null;
  body: { operationName: string; query: string; variables: Record<string, unknown> };
}

function setup() {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs: 500,
    storeCode: 'default',
    currency: 'MXN',
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway: createMagentoAddressGateway(client), ...observability };
}

function respondWith(payload: JsonBodyType, captured: Captured[] = []) {
  server.use(
    http.post(URL, async ({ request }) => {
      captured.push({
        authorization: request.headers.get('authorization'),
        body: (await request.json()) as Captured['body'],
      });
      return HttpResponse.json(payload);
    }),
  );
  return captured;
}

const kindOf = async (promise: Promise<unknown>) =>
  ((await promise.catch((caught: unknown) => caught)) as AddressGatewayError).kind;

const RAW_ADDRESS = {
  id: 7,
  city: 'Tijuana',
  country_code: 'MX',
  default_billing: false,
  default_shipping: true,
  firstname: 'Ana',
  lastname: 'Pérez',
  middlename: null,
  postcode: '22010',
  region: { region: 'Baja California', region_code: 'BCN', region_id: 1 },
  street: ['Av. Revolución', 'Piso 2'],
  telephone: '6643119682',
  custom_attributes: [
    { attribute_code: 'custom_field_1', value: 'García' },
    { attribute_code: 'custom_field_2', value: '123' },
    { attribute_code: 'custom_field_3', value: 'Zona Centro' },
    { attribute_code: 'custom_field_4', value: '-' },
    { attribute_code: 'something_else', value: 'x' },
  ],
};

const INPUT: AddressInput = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  street: ['Av. Revolución', 'Piso 2'],
  city: 'Tijuana',
  postcode: '22010',
  countryId: 'MX',
  region: { name: 'Baja California', id: 1 },
  telephone: '6643119682',
  customFields: {
    custom_field_1: 'García',
    custom_field_2: 'S/N',
    custom_field_3: '',
    custom_field_4: 'Tijuana',
  },
};

describe('createMagentoAddressGateway', () => {
  it('lists the addresses with the legacy query and maps them', async () => {
    const captured = respondWith({ data: { customer: { addresses: [RAW_ADDRESS, null] } } });
    const { gateway, logLines } = setup();

    await expect(gateway.listAddresses(TOKEN)).resolves.toEqual([
      {
        id: 7,
        firstName: 'Ana',
        middleName: '',
        lastName: 'Pérez',
        street: ['Av. Revolución', 'Piso 2'],
        city: 'Tijuana',
        postcode: '22010',
        countryCode: 'MX',
        region: { name: 'Baja California', code: 'BCN', id: 1 },
        telephone: '6643119682',
        defaultShipping: true,
        defaultBilling: false,
        customFields: {
          custom_field_1: 'García',
          custom_field_2: '123',
          custom_field_3: 'Zona Centro',
          custom_field_4: '',
        },
      },
    ]);
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('GetCustomerAddressesForAddressBook');
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });

  it('creates an address with the legacy payload: country_id, region, custom_attributes', async () => {
    const captured = respondWith({ data: { createCustomerAddress: { id: 9 } } });
    await expect(setup().gateway.createAddress(TOKEN, INPUT)).resolves.toBeUndefined();

    expect(captured[0]?.body.operationName).toBe('AddNewCustomerAddressToAddressBook');
    expect(captured[0]?.body.variables).toEqual({
      address: {
        firstname: 'Ana',
        middlename: '',
        lastname: 'Pérez',
        street: ['Av. Revolución', 'Piso 2'],
        city: 'Tijuana',
        postcode: '22010',
        country_id: 'MX',
        region: { region: 'Baja California', region_id: 1 },
        telephone: '6643119682',
        custom_attributes: [
          { attribute_code: 'custom_field_1', value: 'García' },
          { attribute_code: 'custom_field_2', value: 'S/N' },
          { attribute_code: 'custom_field_3', value: '' },
          { attribute_code: 'custom_field_4', value: 'Tijuana' },
        ],
      },
    });
  });

  it('sends only the region name when no region id is known', async () => {
    const captured = respondWith({ data: { createCustomerAddress: { id: 9 } } });
    await setup().gateway.createAddress(TOKEN, { ...INPUT, region: { name: 'Otra', id: null } });
    const sent = captured[0]?.body.variables.address as { region: unknown };
    expect(sent.region).toEqual({ region: 'Otra' });
  });

  it('updates and deletes with the numeric address id', async () => {
    const updated = respondWith({ data: { updateCustomerAddress: { id: 7 } } });
    await setup().gateway.updateAddress(TOKEN, 7, INPUT);
    expect(updated[0]?.body.operationName).toBe('UpdateCustomerAddressInAddressBook');
    expect(updated[0]?.body.variables).toMatchObject({ addressId: 7 });

    const deleted = respondWith({ data: { deleteCustomerAddress: true } });
    await setup().gateway.deleteAddress(TOKEN, 7);
    expect(deleted[0]?.body.operationName).toBe('DeleteCustomerAddressFromAddressBook');
    expect(deleted[0]?.body.variables).toEqual({ addressId: 7 });
  });

  it('fails when Magento does not confirm a delete or answers no address id', async () => {
    respondWith({ data: { deleteCustomerAddress: false } });
    expect(await kindOf(setup().gateway.deleteAddress(TOKEN, 7))).toBe('failure');
    respondWith({ data: { createCustomerAddress: null } });
    expect(await kindOf(setup().gateway.createAddress(TOKEN, INPUT))).toBe('failure');
  });

  it('maps a rejected token to not_authorized and other errors to failure', async () => {
    respondWith({ errors: [{ message: "The current customer isn't authorized." }], data: null });
    expect(await kindOf(setup().gateway.listAddresses(TOKEN))).toBe('not_authorized');
    respondWith({ errors: [{ message: 'Internal server error' }], data: null });
    expect(await kindOf(setup().gateway.listAddresses(TOKEN))).toBe('failure');
  });

  it('reads the regions of a country', async () => {
    const captured = respondWith({
      data: {
        country: {
          id: 'MX',
          available_regions: [{ id: 1, code: 'BCN', name: 'Baja California' }, null, { id: 2 }],
        },
      },
    });
    await expect(setup().gateway.getRegions('MX')).resolves.toEqual([
      { id: 1, code: 'BCN', name: 'Baja California' },
    ]);
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.body.operationName).toBe('GetRegions');
    expect(captured[0]?.body.variables).toEqual({ countryCode: 'MX' });
  });

  it('answers no regions for a country Magento does not list', async () => {
    respondWith({ data: { country: null } });
    await expect(setup().gateway.getRegions('XX')).resolves.toEqual([]);
  });

  it('reads the SEPOMEX municipio of a postal code', async () => {
    const captured = respondWith({
      data: {
        getSepomexData: {
          city: { key: '1', label: 'Tijuana' },
          municipio: 'Tijuana',
          neighborhoods: [],
          state: { key: '2', label: 'Baja California' },
        },
      },
    });
    await expect(setup().gateway.getSepomexMunicipio('22010')).resolves.toBe('Tijuana');
    expect(captured[0]?.body.operationName).toBe('getSepomexData');
    expect(captured[0]?.body.variables).toEqual({ postal_code: '22010' });

    respondWith({ data: { getSepomexData: null } });
    await expect(setup().gateway.getSepomexMunicipio('00000')).resolves.toBeNull();
  });

  it('reads the form config from the Amasty store config fields', async () => {
    const captured = respondWith({
      data: {
        storeConfig: {
          amasty_checkout_manage_checkout_fields: {
            amasty_checkout_checkout_fields: '{"1":{"attribute_code":"firstname"}}',
          },
          amasty_checkout_customer_address_street_lines: 3,
          amasty_checkout_geolocation_google_address_suggestion: true,
          amasty_checkout_geolocation_google_api_key: 'AIza-test',
        },
      },
    });
    await expect(setup().gateway.getFormConfig()).resolves.toEqual({
      fieldsJson: '{"1":{"attribute_code":"firstname"}}',
      streetLines: 3,
      googleSuggestions: true,
      googleApiKey: 'AIza-test',
    });
    expect(captured[0]?.body.operationName).toBe('AddressFormConfig');
  });

  it('answers an empty config when Magento sends nothing', async () => {
    respondWith({ data: { storeConfig: null } });
    await expect(setup().gateway.getFormConfig()).resolves.toEqual({
      fieldsJson: null,
      streetLines: null,
      googleSuggestions: false,
      googleApiKey: null,
    });
  });
});
