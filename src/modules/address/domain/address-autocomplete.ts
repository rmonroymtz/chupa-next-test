import type { RegionOption } from '@/modules/address/application/ports';
import {
  type CustomFieldCode,
  type FieldCode,
  type FormField,
} from '@/modules/address/domain/address';
import {
  POSTCODE_DIGITS,
  sanitizeDigits,
  type AddressFormValues,
} from '@/modules/address/domain/address-form';

/**
 * Autocomplete rules, from the legacy `useStreet` (`handlePlaceSelected`) on the
 * new Google Places API: a place's `addressComponents` fill the form.
 */

/** One entry of the new API `Place.addressComponents`. */
export interface PlaceComponent {
  readonly longText: string;
  readonly shortText: string;
  readonly types: readonly string[];
}

export interface PlaceAddress {
  readonly streetNumber: string;
  readonly route: string;
  readonly postcode: string;
  readonly city: string;
  /** `administrative_area_level_1`: the state. */
  readonly regionName: string;
  /** `administrative_area_level_2`: a first guess for the municipio (SEPOMEX refines it). */
  readonly municipio: string;
  readonly colonia: string;
  readonly countryId: string | null;
}

const has = (component: PlaceComponent, ...types: string[]): boolean =>
  types.some((type) => component.types.includes(type));

/**
 * Same mapping as the legacy (`street_number`, `route`, `postal_code`,
 * `locality`/`postal_town`, `country`, `sublocality_level_1` as colonia). Unlike
 * the legacy, `administrative_area_level_2` does not overwrite the state: it is
 * the municipio.
 */
export function parsePlaceComponents(components: readonly PlaceComponent[]): PlaceAddress {
  const place = {
    streetNumber: '',
    route: '',
    postcode: '',
    city: '',
    regionName: '',
    municipio: '',
    colonia: '',
    countryId: null as string | null,
  };
  for (const component of components) {
    if (has(component, 'street_number')) place.streetNumber = component.longText;
    else if (has(component, 'route')) place.route = component.shortText || component.longText;
    else if (has(component, 'postal_code')) place.postcode = component.longText;
    else if (has(component, 'locality', 'postal_town')) place.city = component.longText;
    else if (has(component, 'administrative_area_level_1')) place.regionName = component.longText;
    else if (has(component, 'administrative_area_level_2')) place.municipio = component.longText;
    else if (has(component, 'country')) place.countryId = component.shortText;
    else if (has(component, 'sublocality_level_1', 'neighborhood'))
      place.colonia = component.longText;
  }
  return place;
}

/** Lowercase, no accents, single spaces: names compare the way people type them. */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const words = (value: string): string[] =>
  normalizeName(value)
    .split(' ')
    .filter((word) => word && word !== 'de');

/**
 * Legacy `handleFindBestMatch`: the exact name wins, else the region whose
 * name shares the most words with the Google name (ignoring "de"). Null when
 * nothing overlaps (the legacy picked the first region).
 */
export function matchRegion(name: string, regions: readonly RegionOption[]): RegionOption | null {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const exact = regions.find((region) => normalizeName(region.name) === wanted);
  if (exact) return exact;
  const searched = words(name);
  if (searched.length === 0) return null;
  let best: { region: RegionOption; score: number } | null = null;
  for (const region of regions) {
    const regionWords = words(region.name);
    const score = searched.filter((word) => regionWords.includes(word)).length / searched.length;
    if (score > 0 && (!best || score > best.score)) best = { region, score };
  }
  return best?.region ?? null;
}

/**
 * The form after the shopper picked a place. Only fields the config renders
 * are touched; what the place does not know is kept; the country stays Mexico.
 * The first street line gets the route (and the number when the config has no
 * "Número" field); the extra lines the shopper typed are kept.
 */
export function applyPlace(
  values: AddressFormValues,
  place: PlaceAddress,
  fields: readonly FormField[],
  regions: readonly RegionOption[],
): AddressFormValues {
  const renders = (code: FieldCode): boolean => fields.some((field) => field.code === code);
  const customFields: Record<CustomFieldCode, string> = { ...values.customFields };
  const next: { -readonly [K in keyof AddressFormValues]: AddressFormValues[K] } = {
    ...values,
    countryId: 'MX',
    customFields,
  };

  if (renders('street')) {
    const first = renders('custom_field_2')
      ? place.route
      : [place.streetNumber, place.route].filter(Boolean).join(' ');
    next.street = values.street.map((line, index) => (index === 0 ? first : line));
  }
  if (renders('custom_field_2')) customFields.custom_field_2 = place.streetNumber;
  if (renders('custom_field_3')) customFields.custom_field_3 = place.colonia;
  if (renders('custom_field_4')) customFields.custom_field_4 = place.municipio;
  if (renders('postcode') && place.postcode) {
    next.postcode = sanitizeDigits(place.postcode, POSTCODE_DIGITS);
  }
  if (renders('city') && place.city) next.city = place.city;
  if (renders('region') && place.regionName) {
    if (regions.length === 0) {
      next.regionName = place.regionName;
      next.regionId = null;
    } else {
      const match = matchRegion(place.regionName, regions);
      if (match) {
        next.regionName = match.name;
        next.regionId = match.id;
      }
    }
  }
  return next;
}
