import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELDS, parseFormFields, type FormField } from '@/modules/address/domain/address';

const field = (code: string, extra: Record<string, unknown> = {}) => ({
  id: code,
  attribute_code: code,
  default_label: code,
  label: '',
  enabled: '1',
  required: '0',
  sort_order: '10',
  width: '100',
  ...extra,
});

const config = (...fields: Record<string, unknown>[]) =>
  JSON.stringify(Object.fromEntries(fields.map((entry, index) => [String(index + 1), entry])));

const codes = (fields: readonly FormField[]) => fields.map((entry) => entry.code);

describe('parseFormFields', () => {
  it('keeps the enabled fields, sorted by sort_order', () => {
    const fields = parseFormFields(
      config(
        field('telephone', { sort_order: '30' }),
        field('firstname', { sort_order: '10' }),
        field('lastname', { sort_order: '20' }),
        field('city', { enabled: '0' }),
      ),
    );
    expect(codes(fields)).toEqual(['firstname', 'lastname', 'telephone']);
  });

  it('drops the fields the legacy form hides by default label (RFC, Persona, Tipo de persona)', () => {
    const fields = parseFormFields(
      config(
        field('firstname'),
        field('custom_field_9', { default_label: 'RFC' }),
        field('custom_field_8', { default_label: 'Persona' }),
        field('custom_field_7', { default_label: 'Tipo de persona' }),
      ),
    );
    expect(codes(fields)).toEqual(['firstname']);
  });

  it('forces region and postcode to be required and labels Número and País', () => {
    const fields = parseFormFields(
      config(
        field('region', { required: '0' }),
        field('postcode', { required: '0' }),
        field('custom_field_2', { default_label: 'External number', label: 'x' }),
        field('country_id', { default_label: 'Country' }),
      ),
    );
    const byCode = Object.fromEntries(fields.map((entry) => [entry.code, entry]));
    expect(byCode.region?.required).toBe(true);
    expect(byCode.postcode?.required).toBe(true);
    expect(byCode.custom_field_2?.label).toBe('Número');
    expect(byCode.country_id?.label).toBe('País');
  });

  it('uses the admin label, else the default label, with width and max length defaults', () => {
    const fields = parseFormFields(
      config(
        field('firstname', { label: 'Nombre(s)' }),
        field('lastname', { label: '', default_label: 'Apellido' }),
        field('telephone', { width: '50', max_length: '12', required: '1' }),
      ),
    );
    expect(fields.map((entry) => entry.label)).toEqual(['Nombre(s)', 'Apellido', 'telephone']);
    expect(fields[0]).toMatchObject({ required: false, width: 100, maxLength: 255 });
    expect(fields[2]).toMatchObject({ required: true, width: 50, maxLength: 12 });
  });

  it('maps the country alias and ignores attribute codes it cannot render', () => {
    const fields = parseFormFields(
      config(field('country'), field('company'), field('save_in_address_book'), field('city')),
    );
    expect(codes(fields)).toEqual(['country_id', 'city']);
  });

  it('accepts a list of fields as well as an object', () => {
    expect(codes(parseFormFields(JSON.stringify([field('firstname'), field('city')])))).toEqual([
      'firstname',
      'city',
    ]);
  });

  it('falls back to the default Mexican fields when the config is missing, invalid or empty', () => {
    for (const raw of [null, undefined, '', 'not json', '{}', '[]', config(field('company'))]) {
      expect(parseFormFields(raw)).toEqual(DEFAULT_FIELDS);
    }
  });

  it('has defaults that cover the recipient and the address groups', () => {
    expect(codes(DEFAULT_FIELDS)).toEqual([
      'firstname',
      'lastname',
      'custom_field_1',
      'telephone',
      'postcode',
      'region',
      'country_id',
      'custom_field_2',
      'custom_field_3',
      'custom_field_4',
      'city',
      'street',
    ]);
    expect(DEFAULT_FIELDS.find((entry) => entry.code === 'region')?.required).toBe(true);
    expect(DEFAULT_FIELDS.find((entry) => entry.code === 'postcode')?.required).toBe(true);
  });
});
