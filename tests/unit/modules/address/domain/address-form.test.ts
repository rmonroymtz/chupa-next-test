import { describe, expect, it } from 'vitest';
import type { CustomerAddress } from '@/modules/address/application/ports';
import { DEFAULT_FIELDS, type FormField } from '@/modules/address/domain/address';
import {
  addressToValues,
  emptyAddressValues,
  maxLengthMessage,
  NO_NUMBER,
  REQUIRED,
  sanitizeDigits,
  toAddressInput,
  validateAddress,
  type AddressFormValues,
} from '@/modules/address/domain/address-form';

const filled = (overrides: Partial<AddressFormValues> = {}): AddressFormValues => ({
  ...emptyAddressValues(2),
  firstName: 'Ana',
  lastName: 'Pérez',
  telephone: '6643119682',
  postcode: '22010',
  city: 'Tijuana',
  regionName: 'Baja California',
  regionId: 1,
  street: ['Av. Revolución', ''],
  customFields: {
    custom_field_1: 'García',
    custom_field_2: '123',
    custom_field_3: 'Zona Centro',
    custom_field_4: 'Tijuana',
  },
  ...overrides,
});

const ADDRESS: CustomerAddress = {
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
    custom_field_2: 'S/N',
    custom_field_3: '',
    custom_field_4: '',
  },
};

const only = (...codes: string[]): readonly FormField[] =>
  DEFAULT_FIELDS.filter((field) => codes.includes(field.code));

describe('sanitizeDigits', () => {
  it('keeps only digits, at most the max', () => {
    expect(sanitizeDigits('(664) 311-9682 99', 12)).toBe('664311968299');
    expect(sanitizeDigits('22010-1234', 5)).toBe('22010');
    expect(sanitizeDigits('abc', 5)).toBe('');
  });
});

describe('emptyAddressValues and addressToValues', () => {
  it('starts empty, in Mexico, with one entry per street line', () => {
    expect(emptyAddressValues(3)).toMatchObject({
      countryId: 'MX',
      regionName: '',
      regionId: null,
      street: ['', '', ''],
    });
  });

  it('prefills from a saved address and pads or trims the street lines', () => {
    expect(addressToValues(ADDRESS, 2)).toMatchObject({
      firstName: 'Ana',
      street: ['Av. Revolución', ''],
      regionName: 'Baja California',
      regionId: 1,
      countryId: 'MX',
      customFields: { custom_field_2: 'S/N' },
    });
    expect(addressToValues({ ...ADDRESS, street: ['a', 'b', 'c'] }, 2).street).toEqual(['a', 'b']);
  });
});

describe('validateAddress', () => {
  it('accepts a complete address with the default fields', () => {
    expect(validateAddress(filled(), DEFAULT_FIELDS)).toEqual({});
  });

  it('requires the required fields that are empty', () => {
    const errors = validateAddress(emptyAddressValues(2), DEFAULT_FIELDS);
    expect(Object.keys(errors).sort()).toEqual(
      [
        'city',
        'custom_field_2',
        'custom_field_3',
        'custom_field_4',
        'firstname',
        'lastname',
        'postcode',
        'region',
        'street',
        'telephone',
      ].sort(),
    );
    expect(errors.firstname).toBe(REQUIRED);
    expect(errors.street).toBe(REQUIRED);
  });

  it('accepts a region picked by id or typed by name, and "S/N" as the number', () => {
    expect(
      validateAddress(filled({ regionName: '', regionId: 3 }), DEFAULT_FIELDS).region,
    ).toBeUndefined();
    expect(
      validateAddress(filled({ regionName: 'Otra', regionId: null }), DEFAULT_FIELDS).region,
    ).toBeUndefined();
    expect(
      validateAddress(
        filled({ customFields: { ...filled().customFields, custom_field_2: NO_NUMBER } }),
        DEFAULT_FIELDS,
      ).custom_field_2,
    ).toBeUndefined();
  });

  it('checks the max length of the text fields', () => {
    const fields: readonly FormField[] = [
      { code: 'firstname', label: 'Nombre', required: true, width: 50, maxLength: 5 },
    ];
    expect(validateAddress(filled({ firstName: 'Anastasia' }), fields).firstname).toBe(
      maxLengthMessage(5),
    );
    expect(maxLengthMessage(5)).toBe('No debe exceder 5 caracteres.');
  });

  it('only validates the fields the config renders', () => {
    expect(validateAddress(emptyAddressValues(2), only('firstname'))).toEqual({
      firstname: REQUIRED,
    });
  });

  it('treats whitespace as empty', () => {
    expect(validateAddress(filled({ firstName: '  ' }), DEFAULT_FIELDS).firstname).toBe(REQUIRED);
    expect(validateAddress(filled({ street: ['   ', 'x'] }), DEFAULT_FIELDS).street).toBe(REQUIRED);
  });
});

describe('addressToValues phone', () => {
  it('keeps only the digits of a stored phone with spaces or a prefix', () => {
    expect(addressToValues({ ...ADDRESS, telephone: '55 1234 5678' }, 2).telephone).toBe(
      '5512345678',
    );
    expect(addressToValues({ ...ADDRESS, telephone: '+52 664 311 9682' }, 2).telephone).toBe(
      '526643119682',
    );
  });
});

describe('toAddressInput', () => {
  it('builds the payload: trimmed values, non-empty street lines, the config custom fields', () => {
    expect(
      toAddressInput(
        filled({ firstName: ' Ana ', street: [' Av. Revolución ', ' Piso 2 '] }),
        DEFAULT_FIELDS,
      ),
    ).toEqual({
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
        custom_field_2: '123',
        custom_field_3: 'Zona Centro',
        custom_field_4: 'Tijuana',
      },
    });
  });

  it('keeps the middle name of the address being edited', () => {
    expect(toAddressInput(filled(), DEFAULT_FIELDS, ADDRESS).middleName).toBe('María');
  });

  it('leaves out the fields the config does not render', () => {
    const input = toAddressInput(
      filled(),
      only('firstname', 'lastname', 'street', 'custom_field_2'),
    );
    expect(input.customFields).toEqual({ custom_field_2: '123' });
    expect(input.city).toBe('');
    expect(input.postcode).toBe('');
    expect(input.telephone).toBe('');
    expect(input.region).toEqual({ name: '', id: null });
  });

  it('keeps the stored city, postcode, region and phone of an edit when the config does not render them', () => {
    const input = toAddressInput(
      filled({ city: 'Otra', postcode: '99999', telephone: '1' }),
      only('firstname', 'lastname', 'street'),
      { ...ADDRESS, telephone: '664 311 9682' },
    );
    expect(input).toMatchObject({
      city: 'Tijuana',
      postcode: '22010',
      region: { name: 'Baja California', id: 1 },
      telephone: '6643119682',
      middleName: 'María',
    });
  });
});
