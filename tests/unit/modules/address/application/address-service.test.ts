import { describe, expect, it, vi } from 'vitest';
import {
  addressIdInputSchema,
  deleteAddressInputSchema,
  postcodeInputSchema,
  saveAddressInputSchema,
  updateAddressInputSchema,
} from '@/modules/address/application/address-input';
import { createAddressService } from '@/modules/address/application/address-service';
import {
  AddressGatewayError,
  type AddressGateway,
  type AddressInput,
  type CustomerAddress,
} from '@/modules/address/application/ports';
import { DEFAULT_FIELDS } from '@/modules/address/domain/address';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'secret.jwt.token';
const INPUT: AddressInput = {
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
    custom_field_2: 'S/N',
    custom_field_3: '',
    custom_field_4: '',
  },
};
const ADDRESS = { id: 7, firstName: 'Ana' } as unknown as CustomerAddress;

function setup(gateway: Partial<Record<keyof AddressGateway, unknown>>) {
  const observability = createCapturingObservability();
  const service = createAddressService({
    gateway: gateway as unknown as AddressGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, ...observability };
}

const fail = (kind: ConstructorParameters<typeof AddressGatewayError>[0]) =>
  vi.fn().mockRejectedValue(new AddressGatewayError(kind, 'boom'));

describe('address service list', () => {
  it('answers the addresses', async () => {
    const listAddresses = vi.fn().mockResolvedValue([ADDRESS]);
    const { service } = setup({ listAddresses });
    expect(await service.list({ token: TOKEN })).toEqual({ status: 'ok', addresses: [ADDRESS] });
    expect(listAddresses).toHaveBeenCalledWith(TOKEN);
  });

  it('reports a rejected token and other failures', async () => {
    expect(
      await setup({ listAddresses: fail('not_authorized') }).service.list({ token: TOKEN }),
    ).toEqual({
      status: 'not_authorized',
    });
    expect(await setup({ listAddresses: fail('failure') }).service.list({ token: TOKEN })).toEqual({
      status: 'failed',
    });
  });
});

describe('address service changes', () => {
  it('creates, updates and deletes, with a metric per operation', async () => {
    const gateway = {
      createAddress: vi.fn().mockResolvedValue(undefined),
      updateAddress: vi.fn().mockResolvedValue(undefined),
      deleteAddress: vi.fn().mockResolvedValue(undefined),
    };
    const { service, metricsNamed } = setup(gateway);

    expect(await service.create({ token: TOKEN, address: INPUT })).toEqual({ status: 'saved' });
    expect(await service.update({ token: TOKEN, id: 7, address: INPUT })).toEqual({
      status: 'saved',
    });
    expect(await service.remove({ token: TOKEN, id: 7 })).toEqual({ status: 'saved' });
    expect(gateway.createAddress).toHaveBeenCalledWith(TOKEN, INPUT);
    expect(gateway.updateAddress).toHaveBeenCalledWith(TOKEN, 7, INPUT);
    expect(gateway.deleteAddress).toHaveBeenCalledWith(TOKEN, 7);
    expect(metricsNamed('AddressChange').map((metric) => metric.dimensions)).toEqual([
      { Operation: 'create', Outcome: 'saved' },
      { Operation: 'update', Outcome: 'saved' },
      { Operation: 'delete', Outcome: 'saved' },
    ]);
  });

  it('reports a rejected token and failures, never logging the token or the address', async () => {
    const { service, logLines } = setup({
      createAddress: fail('failure'),
      deleteAddress: fail('not_authorized'),
    });
    expect(await service.create({ token: TOKEN, address: INPUT })).toEqual({ status: 'failed' });
    expect(await service.remove({ token: TOKEN, id: 7 })).toEqual({ status: 'not_authorized' });
    const text = JSON.stringify(logLines);
    for (const secret of [TOKEN, 'Ana', 'Pérez', '6643119682', 'Av. Revolución']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('address service regions and SEPOMEX', () => {
  it('answers the regions, or a failure so the form falls back to a text input', async () => {
    const regions = [{ id: 1, code: 'BCN', name: 'Baja California' }];
    expect(
      await setup({ getRegions: vi.fn().mockResolvedValue(regions) }).service.regions({
        countryCode: 'MX',
      }),
    ).toEqual({ status: 'ok', regions });
    expect(
      await setup({ getRegions: fail('failure') }).service.regions({ countryCode: 'MX' }),
    ).toEqual({
      status: 'failed',
    });
  });

  it('answers the municipio, null when unknown, and a silent failure', async () => {
    expect(
      await setup({ getSepomexMunicipio: vi.fn().mockResolvedValue('Tijuana') }).service.sepomex({
        postalCode: '22010',
      }),
    ).toEqual({ status: 'ok', municipio: 'Tijuana' });
    expect(
      await setup({ getSepomexMunicipio: vi.fn().mockResolvedValue(null) }).service.sepomex({
        postalCode: '00000',
      }),
    ).toEqual({ status: 'ok', municipio: null });
    expect(
      await setup({ getSepomexMunicipio: fail('failure') }).service.sepomex({ postalCode: '1' }),
    ).toEqual({
      status: 'failed',
    });
  });
});

describe('address service form config', () => {
  const config = (overrides: Record<string, unknown> = {}) =>
    vi.fn().mockResolvedValue({
      fieldsJson: '{"1":{"attribute_code":"firstname","enabled":"1","sort_order":"1"}}',
      streetLines: 3,
      googleSuggestions: true,
      googleApiKey: 'AIza-test',
      ...overrides,
    });

  it('parses the fields and exposes the Google key only when suggestions are on', async () => {
    const result = await setup({ getFormConfig: config() }).service.formConfig();
    expect(result.fields.map((entry) => entry.code)).toEqual(['firstname']);
    expect(result).toMatchObject({ streetLines: 3, googleApiKey: 'AIza-test' });

    expect(
      (await setup({ getFormConfig: config({ googleSuggestions: false }) }).service.formConfig())
        .googleApiKey,
    ).toBeNull();
    expect(
      (await setup({ getFormConfig: config({ googleApiKey: ' ' }) }).service.formConfig())
        .googleApiKey,
    ).toBeNull();
  });

  it('defaults to two street lines and clamps the configured count to 1..5', async () => {
    expect(
      (await setup({ getFormConfig: config({ streetLines: null }) }).service.formConfig())
        .streetLines,
    ).toBe(2);
    expect(
      (await setup({ getFormConfig: config({ streetLines: 0 }) }).service.formConfig()).streetLines,
    ).toBe(1);
    expect(
      (await setup({ getFormConfig: config({ streetLines: 9 }) }).service.formConfig()).streetLines,
    ).toBe(5);
  });

  it('never fails: the default Mexican fields and no Google when Magento cannot answer', async () => {
    const { service, logLines } = setup({ getFormConfig: fail('failure') });
    expect(await service.formConfig()).toEqual({
      fields: DEFAULT_FIELDS,
      streetLines: 2,
      googleApiKey: null,
    });
    expect(logLines.length).toBeGreaterThan(0);
  });
});

describe('address input schemas', () => {
  const base = { token: 'a.b.c' };

  it('accepts a complete address', () => {
    expect(saveAddressInputSchema.safeParse({ ...base, address: INPUT }).success).toBe(true);
    expect(updateAddressInputSchema.safeParse({ ...base, id: 7, address: INPUT }).success).toBe(
      true,
    );
  });

  it('rejects malformed addresses', () => {
    const bad = (patch: Record<string, unknown>) =>
      saveAddressInputSchema.safeParse({ ...base, address: { ...INPUT, ...patch } }).success;
    expect(bad({ firstName: ' ' })).toBe(false);
    expect(bad({ street: [] })).toBe(false);
    expect(bad({ street: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBe(false);
    expect(bad({ telephone: '12ab' })).toBe(false);
    expect(bad({ telephone: '1234567890123' })).toBe(false);
    expect(bad({ countryId: 'mex' })).toBe(false);
    expect(bad({ postcode: 'x'.repeat(13) })).toBe(false);
    expect(bad({ region: { name: 'x', id: -1 } })).toBe(false);
    expect(bad({ customFields: { custom_field_1: 'x'.repeat(256) } })).toBe(false);
    expect(saveAddressInputSchema.safeParse({ token: '', address: INPUT }).success).toBe(false);
  });

  it('rejects unknown custom fields instead of passing them to Magento', () => {
    expect(
      saveAddressInputSchema.safeParse({
        ...base,
        address: { ...INPUT, customFields: { ...INPUT.customFields, is_admin: '1' } },
      }).success,
    ).toBe(false);
  });

  it('validates ids, delete input and the postal code lookup', () => {
    expect(addressIdInputSchema.safeParse(7).success).toBe(true);
    expect(addressIdInputSchema.safeParse(0).success).toBe(false);
    expect(addressIdInputSchema.safeParse(1.5).success).toBe(false);
    expect(deleteAddressInputSchema.safeParse({ ...base, id: 7 }).success).toBe(true);
    expect(deleteAddressInputSchema.safeParse({ ...base, id: '7' }).success).toBe(false);
    expect(postcodeInputSchema.safeParse({ postalCode: '22010' }).success).toBe(true);
    expect(postcodeInputSchema.safeParse({ postalCode: '2201' }).success).toBe(false);
    expect(postcodeInputSchema.safeParse({ postalCode: 'abcde' }).success).toBe(false);
  });
});
