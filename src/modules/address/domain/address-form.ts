import type { AddressInput, CustomerAddress } from '@/modules/address/application/ports';
import {
  CUSTOM_FIELD_CODES,
  type CustomFieldCode,
  type FieldCode,
  type FormField,
} from '@/modules/address/domain/address';

/**
 * Values, validation and payload of the address form (legacy `AddressFormPage`
 * and `@chupaprecios/form-address`). Only the fields the Amasty config renders
 * are validated and sent.
 */

export const REQUIRED = 'Este campo es obligatorio';
/** Value of "Número" when the shopper checks "Sin número". */
export const NO_NUMBER = 'S/N';
/** The legacy phone and postcode formatters. */
export const TELEPHONE_DIGITS = 12;
export const POSTCODE_DIGITS = 5;

/** The legacy message is Venia's English default; this is its Spanish form. */
export const maxLengthMessage = (max: number): string => `No debe exceder ${max} caracteres.`;

export interface AddressFormValues {
  readonly firstName: string;
  readonly lastName: string;
  readonly telephone: string;
  readonly postcode: string;
  readonly city: string;
  readonly countryId: string;
  /** Typed region, or the name of the picked one. */
  readonly regionName: string;
  /** Magento region id when the shopper picked one. */
  readonly regionId: number | null;
  /** One entry per street line of the config. */
  readonly street: readonly string[];
  readonly customFields: Readonly<Record<CustomFieldCode, string>>;
}

export type AddressFormErrors = Partial<Record<FieldCode, string>>;

export function sanitizeDigits(raw: string, max: number): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

const blankCustomFields = (): Record<CustomFieldCode, string> => ({
  custom_field_1: '',
  custom_field_2: '',
  custom_field_3: '',
  custom_field_4: '',
});

const padStreet = (lines: readonly string[], count: number): string[] =>
  Array.from({ length: count }, (_unused, index) => lines[index] ?? '');

/** A new address: Mexico by default (legacy `country_id: 'MX'`). */
export function emptyAddressValues(streetLines: number): AddressFormValues {
  return {
    firstName: '',
    lastName: '',
    telephone: '',
    postcode: '',
    city: '',
    countryId: 'MX',
    regionName: '',
    regionId: null,
    street: padStreet([], streetLines),
    customFields: blankCustomFields(),
  };
}

export function addressToValues(address: CustomerAddress, streetLines: number): AddressFormValues {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    telephone: address.telephone,
    postcode: address.postcode,
    city: address.city,
    countryId: address.countryCode || 'MX',
    regionName: address.region.name,
    regionId: address.region.id,
    street: padStreet(address.street, streetLines),
    customFields: { ...blankCustomFields(), ...address.customFields },
  };
}

function valueOf(values: AddressFormValues, code: FieldCode): string {
  switch (code) {
    case 'firstname':
      return values.firstName;
    case 'lastname':
      return values.lastName;
    case 'telephone':
      return values.telephone;
    case 'postcode':
      return values.postcode;
    case 'city':
      return values.city;
    case 'country_id':
      return values.countryId;
    case 'region':
      return values.regionId !== null ? String(values.regionId) : values.regionName;
    case 'street':
      return values.street[0] ?? '';
    default:
      return values.customFields[code];
  }
}

/** Required and max length of each rendered field, on submit. Messages are per field code. */
export function validateAddress(
  values: AddressFormValues,
  fields: readonly FormField[],
): AddressFormErrors {
  const errors: AddressFormErrors = {};
  for (const field of fields) {
    if (field.code === 'country_id') continue;
    const value = valueOf(values, field.code).trim();
    if (field.required && value === '') errors[field.code] = REQUIRED;
    else if (value.length > field.maxLength) errors[field.code] = maxLengthMessage(field.maxLength);
  }
  return errors;
}

/** The `CustomerAddressInput` payload; `middleName` is kept from the address being edited. */
export function toAddressInput(
  values: AddressFormValues,
  fields: readonly FormField[],
  middleName = '',
): AddressInput {
  const has = (code: FieldCode): boolean => fields.some((field) => field.code === code);
  return {
    firstName: values.firstName.trim(),
    middleName,
    lastName: values.lastName.trim(),
    street: values.street.map((line) => line.trim()).filter(Boolean),
    city: has('city') ? values.city.trim() : '',
    postcode: has('postcode') ? values.postcode.trim() : '',
    countryId: values.countryId,
    region: has('region')
      ? { name: values.regionName.trim(), id: values.regionId }
      : { name: '', id: null },
    telephone: has('telephone') ? values.telephone.trim() : '',
    customFields: Object.fromEntries(
      CUSTOM_FIELD_CODES.filter((code) => has(code)).map((code) => [
        code,
        values.customFields[code].trim(),
      ]),
    ),
  };
}
