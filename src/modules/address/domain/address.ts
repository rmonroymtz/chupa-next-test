/**
 * Pure rules of the address form, from the legacy PWA `@chupaprecios/form-address`
 * (`useFormAddress`). The form is driven by the Amasty checkout fields JSON in
 * `storeConfig`; this parses it into the fields Next can render.
 */

/** Address attributes the Mexican form uses; `custom_field_*` are Magento custom address attributes. */
export const CUSTOM_FIELD_CODES = [
  'custom_field_1',
  'custom_field_2',
  'custom_field_3',
  'custom_field_4',
] as const;
export type CustomFieldCode = (typeof CUSTOM_FIELD_CODES)[number];

export type FieldCode =
  | 'firstname'
  | 'lastname'
  | 'telephone'
  | 'postcode'
  | 'region'
  | 'country_id'
  | 'city'
  | 'street'
  | CustomFieldCode;

const SUPPORTED_CODES: ReadonlySet<string> = new Set<FieldCode>([
  'firstname',
  'lastname',
  'telephone',
  'postcode',
  'region',
  'country_id',
  'city',
  'street',
  ...CUSTOM_FIELD_CODES,
]);

export interface FormField {
  readonly code: FieldCode;
  readonly label: string;
  readonly required: boolean;
  /** Share of the row, in percent (legacy `--amOscFieldWidth`). */
  readonly width: number;
  readonly maxLength: number;
}

/** Labels the legacy hides (they belong to the billing/RFC fields), matched on the admin default label. */
const EXCLUDED_DEFAULT_LABELS = ['RFC', 'Persona', 'Tipo de persona'];
const DEFAULT_MAX_LENGTH = 255;

/**
 * Fields when Magento has no usable Amasty config (the legacy rendered an empty
 * form). Labels and required flags are Next's own: the Mexican address of the
 * legacy form, with `region` and `postcode` required as it forces them.
 */
export const DEFAULT_FIELDS: readonly FormField[] = [
  { code: 'firstname', label: 'Nombre', required: true, width: 50, maxLength: 255 },
  { code: 'lastname', label: 'Apellido', required: true, width: 50, maxLength: 255 },
  { code: 'custom_field_1', label: 'Apellido materno', required: false, width: 50, maxLength: 255 },
  { code: 'telephone', label: 'Teléfono', required: true, width: 50, maxLength: 12 },
  { code: 'postcode', label: 'Código postal', required: true, width: 50, maxLength: 5 },
  { code: 'region', label: 'Estado', required: true, width: 50, maxLength: 255 },
  { code: 'country_id', label: 'País', required: true, width: 50, maxLength: 255 },
  { code: 'custom_field_2', label: 'Número', required: true, width: 50, maxLength: 255 },
  { code: 'custom_field_3', label: 'Colonia', required: true, width: 50, maxLength: 255 },
  { code: 'custom_field_4', label: 'Municipio', required: true, width: 50, maxLength: 255 },
  { code: 'city', label: 'Ciudad', required: true, width: 50, maxLength: 255 },
  { code: 'street', label: 'Dirección', required: true, width: 100, maxLength: 255 },
];

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null;
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
/** Amasty stores flags as "0"/"1" strings; "false" and blanks count as off. */
const flag = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'false') return false;
  return Number(value) !== 0;
};
const positive = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

/**
 * Enabled fields of the Amasty JSON, without the excluded labels, sorted by
 * `sort_order`; `region` and `postcode` are always required, `custom_field_2`
 * is "Número" and `country_id` "País" (legacy `handleLocalManageFields`).
 * Attribute codes Next cannot render are ignored. An empty or unparseable
 * config gives {@link DEFAULT_FIELDS}.
 */
export function parseFormFields(json: string | null | undefined): readonly FormField[] {
  if (!json) return DEFAULT_FIELDS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return DEFAULT_FIELDS;
  }
  const entries = Array.isArray(parsed) ? parsed : Object.values(asRecord(parsed) ?? {});
  const fields = entries
    .flatMap((entry, index) => {
      const item = asRecord(entry);
      if (!item || !flag(item.enabled)) return [];
      const defaultLabel = asText(item.default_label);
      if (EXCLUDED_DEFAULT_LABELS.includes(defaultLabel)) return [];
      const rawCode = asText(item.attribute_code);
      const code = rawCode === 'country' ? 'country_id' : rawCode;
      if (!SUPPORTED_CODES.has(code)) return [];
      const label =
        code === 'custom_field_2'
          ? 'Número'
          : code === 'country_id'
            ? 'País'
            : asText(item.label) || defaultLabel || code;
      const field: FormField = {
        code: code as FieldCode,
        label,
        required: code === 'region' || code === 'postcode' || flag(item.required),
        width: positive(item.width, 100),
        maxLength: positive(item.max_length, DEFAULT_MAX_LENGTH),
      };
      return [{ field, order: Number(item.sort_order) || 0, index }];
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((entry) => entry.field);
  return fields.length > 0 ? fields : DEFAULT_FIELDS;
}
