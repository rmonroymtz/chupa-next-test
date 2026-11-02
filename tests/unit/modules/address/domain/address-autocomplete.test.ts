import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELDS, type FormField } from '@/modules/address/domain/address';
import {
  applyPlace,
  matchRegion,
  normalizeName,
  parsePlaceComponents,
  type PlaceComponent,
} from '@/modules/address/domain/address-autocomplete';
import { emptyAddressValues } from '@/modules/address/domain/address-form';

const component = (longText: string, shortText: string, ...types: string[]): PlaceComponent => ({
  longText,
  shortText,
  types,
});

/** What Google answers for a Mexican address (new Places API, `addressComponents`). */
const TIJUANA: PlaceComponent[] = [
  component('123', '123', 'street_number'),
  component('Avenida Revolución', 'Av. Revolución', 'route'),
  component('Zona Centro', 'Zona Centro', 'sublocality_level_1', 'sublocality', 'political'),
  component('Tijuana', 'Tijuana', 'locality', 'political'),
  component('Tijuana', 'Tijuana', 'administrative_area_level_2', 'political'),
  component('Baja California', 'B.C.', 'administrative_area_level_1', 'political'),
  component('México', 'MX', 'country', 'political'),
  component('22010', '22010', 'postal_code'),
];

const REGIONS = [
  { id: 1, code: 'BCN', name: 'Baja California' },
  { id: 2, code: 'SON', name: 'Sonora' },
  { id: 3, code: 'NLE', name: 'Nuevo León' },
  { id: 4, code: 'MEX', name: 'México' },
  { id: 5, code: 'CMX', name: 'Ciudad de México' },
];

const without = (code: string): readonly FormField[] =>
  DEFAULT_FIELDS.filter((field) => field.code !== code);

describe('normalizeName', () => {
  it('lowercases and drops accents and extra spaces', () => {
    expect(normalizeName('  Nuevo   León ')).toBe('nuevo leon');
  });
});

describe('parsePlaceComponents', () => {
  it('maps the Google components to the address pieces', () => {
    expect(parsePlaceComponents(TIJUANA)).toEqual({
      streetNumber: '123',
      route: 'Av. Revolución',
      postcode: '22010',
      city: 'Tijuana',
      regionName: 'Baja California',
      municipio: 'Tijuana',
      colonia: 'Zona Centro',
      countryId: 'MX',
    });
  });

  it('uses the postal town when there is no locality and the neighborhood as colonia', () => {
    const place = parsePlaceComponents([
      component('Reading', 'Reading', 'postal_town'),
      component('Centro', 'Centro', 'neighborhood', 'political'),
    ]);
    expect(place.city).toBe('Reading');
    expect(place.colonia).toBe('Centro');
  });

  it('answers empty pieces for components it does not know', () => {
    expect(parsePlaceComponents([component('x', 'x', 'floor')])).toEqual({
      streetNumber: '',
      route: '',
      postcode: '',
      city: '',
      regionName: '',
      municipio: '',
      colonia: '',
      countryId: null,
    });
  });
});

describe('matchRegion', () => {
  it('matches the exact name, ignoring case and accents', () => {
    expect(matchRegion('baja california', REGIONS)?.id).toBe(1);
    expect(matchRegion('Nuevo Leon', REGIONS)?.id).toBe(3);
  });

  it('prefers the best word overlap, ignoring "de"', () => {
    expect(matchRegion('Estado de México', REGIONS)?.id).toBe(4);
    expect(matchRegion('Mexico City', REGIONS)?.id).toBe(4);
  });

  it('is null when nothing matches (the legacy picked the first region)', () => {
    expect(matchRegion('Atlantis', REGIONS)).toBeNull();
    expect(matchRegion('', REGIONS)).toBeNull();
    expect(matchRegion('Sonora', [])).toBeNull();
  });
});

describe('applyPlace', () => {
  const place = parsePlaceComponents(TIJUANA);

  it('fills the address from the place: route, number, colonia, municipio, postcode, city, region', () => {
    const values = applyPlace(emptyAddressValues(2), place, DEFAULT_FIELDS, REGIONS);
    expect(values).toMatchObject({
      street: ['Av. Revolución', ''],
      city: 'Tijuana',
      postcode: '22010',
      countryId: 'MX',
      regionName: 'Baja California',
      regionId: 1,
      customFields: {
        custom_field_2: '123',
        custom_field_3: 'Zona Centro',
        custom_field_4: 'Tijuana',
      },
    });
  });

  it('puts the number in the street line when the config has no Número field', () => {
    const values = applyPlace(emptyAddressValues(2), place, without('custom_field_2'), REGIONS);
    expect(values.street[0]).toBe('123 Av. Revolución');
    expect(values.customFields.custom_field_2).toBe('');
  });

  it('keeps the extra street lines the shopper typed', () => {
    const base = { ...emptyAddressValues(2), street: ['x', 'Piso 2'] };
    expect(applyPlace(base, place, DEFAULT_FIELDS, REGIONS).street).toEqual([
      'Av. Revolución',
      'Piso 2',
    ]);
  });

  it('types the region name when Magento lists no regions, and keeps the region on no match', () => {
    expect(applyPlace(emptyAddressValues(2), place, DEFAULT_FIELDS, []).regionName).toBe(
      'Baja California',
    );
    const unknown = parsePlaceComponents([
      component('Atlantis', 'AT', 'administrative_area_level_1'),
    ]);
    const base = { ...emptyAddressValues(2), regionName: 'Sonora', regionId: 2 };
    expect(applyPlace(base, unknown, DEFAULT_FIELDS, REGIONS)).toMatchObject({
      regionName: 'Sonora',
      regionId: 2,
    });
  });

  it('only fills the fields the config renders', () => {
    const values = applyPlace(
      emptyAddressValues(2),
      place,
      DEFAULT_FIELDS.filter((field) => ['street', 'postcode'].includes(field.code)),
      REGIONS,
    );
    expect(values.postcode).toBe('22010');
    expect(values.city).toBe('');
    expect(values.regionId).toBeNull();
    expect(values.customFields.custom_field_3).toBe('');
  });

  it('keeps what the place does not know and always stays in Mexico', () => {
    const sparse = parsePlaceComponents([component('Calle 5', 'Calle 5', 'route')]);
    const base = { ...emptyAddressValues(2), city: 'Mexicali', postcode: '21100' };
    expect(applyPlace(base, sparse, DEFAULT_FIELDS, REGIONS)).toMatchObject({
      city: 'Mexicali',
      postcode: '21100',
      countryId: 'MX',
    });
  });
});
