'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  AddressFormConfig,
  CustomerAddress,
  RegionOption,
} from '@/modules/address/application/ports';
import {
  CUSTOM_FIELD_CODES,
  type CustomFieldCode,
  type FieldCode,
  type FormField,
} from '@/modules/address/domain/address';
import {
  applyPlace,
  parsePlaceComponents,
  type PlaceComponent,
} from '@/modules/address/domain/address-autocomplete';
import {
  addressToValues,
  emptyAddressValues,
  NO_NUMBER,
  POSTCODE_DIGITS,
  sanitizeDigits,
  TELEPHONE_DIGITS,
  toAddressInput,
  validateAddress,
  type AddressFormErrors,
  type AddressFormValues,
} from '@/modules/address/domain/address-form';
import {
  createAddressAction,
  getAddressFormConfigAction,
  getRegionsAction,
  getSepomexAction,
  listAddressesAction,
  updateAddressAction,
} from '@/modules/address/ui/address-actions';
import { useAccountProfile } from '@/modules/account/ui/account-profile';
import { redirectBrowser } from '@/modules/account/ui/browser-redirect';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { authHref } from '@/modules/customer/domain/auth-forms';
import { FormError } from '@/modules/customer/ui/form-error';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { cx } from '@/shared/ui/class-names';
import { Input } from '@/shared/ui/input';
import { StreetAutocomplete } from '@/modules/account/ui/street-autocomplete.client';
import { Select } from '@/shared/ui/select';

const ADDRESS_BOOK_PATH = '/my-account/address-book';
const NEW_PATH = `${ADDRESS_BOOK_PATH}/new`;
const LOAD_ERROR = 'Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.';
const SAVE_ERROR = 'No pudimos guardar la dirección. Revisa los datos e inténtalo de nuevo.';
const COUNTRY_LABEL = 'México';
const COUNTRY_CODE = 'MX';

/** A token Magento rejects: drop it and sign in again, coming back to this form. */
function dropSession(returnPath: string): void {
  browserCartStorage.clearSigninToken();
  redirectBrowser(authHref('/sign-in', returnPath));
}

/** Fields a picked place can fill, whose errors it clears. */
const FILLED_BY_PLACE: readonly FieldCode[] = [
  'street',
  'postcode',
  'city',
  'region',
  'custom_field_2',
  'custom_field_3',
  'custom_field_4',
];

/** Fields of the legacy "Destinatario" group; the others go under "Dirección". */
const RECIPIENT_CODES: readonly FieldCode[] = [
  'firstname',
  'lastname',
  'custom_field_1',
  'telephone',
];

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'ready';
      readonly config: AddressFormConfig;
      readonly regions: readonly RegionOption[];
      readonly original: CustomerAddress | null;
      readonly initial: AddressFormValues;
    };

interface AddressFormProps {
  /** The address being edited; a new address when missing. */
  readonly addressId?: number;
}

/**
 * Legacy `AddressFormPage` (`/my-account/address-book/new` and `/edit/:id`).
 * The fields come from the Amasty config (`getAddressFormConfigAction`), the
 * regions from Magento's Mexican regions. An edit reads the address by id (the
 * legacy needed the address in the router state, so a direct url showed an
 * empty form). The country is fixed to Mexico.
 */
export function AddressForm({ addressId }: AddressFormProps) {
  const { token } = useAccountProfile();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const editing = addressId !== undefined;
  const returnPath = editing ? `${ADDRESS_BOOK_PATH}/edit/${addressId}` : NEW_PATH;

  // Nothing sets state before the first await, so the mount effect never sets it synchronously.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [config, regions, list] = await Promise.all([
          getAddressFormConfigAction(),
          getRegionsAction({ countryCode: COUNTRY_CODE }),
          addressId === undefined ? Promise.resolve(null) : listAddressesAction({ token }),
        ]);
        if (cancelled) return;
        if (list?.status === 'not_authorized') {
          dropSession(returnPath);
          return;
        }
        if (list && list.status !== 'ok') {
          setState({ kind: 'error' });
          return;
        }
        const original = list
          ? (list.addresses.find((entry) => entry.id === addressId) ?? null)
          : null;
        if (addressId !== undefined && !original) {
          setState({ kind: 'not_found' });
          return;
        }
        setState({
          kind: 'ready',
          config,
          // A failed regions read leaves the region as a text input, like Magento with no regions.
          regions: regions.status === 'ok' ? regions.regions : [],
          original,
          initial: original
            ? addressToValues(original, config.streetLines)
            : emptyAddressValues(config.streetLines),
        });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, addressId, returnPath]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-ds-text-secondary">
        Cargando…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p role="alert" className="py-16 text-center text-ds-text-error">
        {LOAD_ERROR}
      </p>
    );
  }
  if (state.kind === 'not_found') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-ds-text">No encontramos esta dirección.</p>
        <a
          href={ADDRESS_BOOK_PATH}
          className="rounded-xs font-semibold text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
        >
          Volver a mis direcciones
        </a>
      </div>
    );
  }

  return (
    <AddressFormBody
      token={token}
      addressId={addressId}
      config={state.config}
      regions={state.regions}
      original={state.original}
      initial={state.initial}
      onUnauthorized={() => dropSession(returnPath)}
    />
  );
}

interface BodyProps {
  readonly token: string;
  readonly addressId: number | undefined;
  readonly config: AddressFormConfig;
  readonly regions: readonly RegionOption[];
  readonly original: CustomerAddress | null;
  readonly initial: AddressFormValues;
  onUnauthorized(): void;
}

function AddressFormBody({
  token,
  addressId,
  config,
  regions,
  original,
  initial,
  onUnauthorized,
}: BodyProps) {
  const [values, setValues] = useState<AddressFormValues>(initial);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recipient = config.fields.filter((entry) => RECIPIENT_CODES.includes(entry.code));
  const address = config.fields.filter((entry) => !RECIPIENT_CODES.includes(entry.code));

  function patch(change: Partial<AddressFormValues>, code: FieldCode): void {
    setValues((current) => ({ ...current, ...change }));
    setErrors((current) => {
      if (!(code in current)) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
  }

  function setCustom(
    code: 'custom_field_1' | 'custom_field_2' | 'custom_field_3' | 'custom_field_4',
    value: string,
  ): void {
    patch({ customFields: { ...values.customFields, [code]: value } }, code);
  }

  /** A place was picked: fill the form, then let SEPOMEX refine the municipio. */
  async function onPlace(components: readonly PlaceComponent[]): Promise<void> {
    const place = parsePlaceComponents(components);
    setValues((current) => applyPlace(current, place, config.fields, regions));
    setErrors((current) => {
      const next = { ...current };
      for (const code of FILLED_BY_PLACE) delete next[code];
      return next;
    });
    const postalCode = sanitizeDigits(place.postcode, POSTCODE_DIGITS);
    if (postalCode.length !== POSTCODE_DIGITS) return;
    if (!config.fields.some((entry) => entry.code === 'custom_field_4')) return;
    const result = await getSepomexAction({ postalCode }).catch(() => null);
    if (result?.status !== 'ok' || !result.municipio) return;
    const municipio = result.municipio;
    // The shopper may have changed the postal code meanwhile.
    setValues((current) =>
      current.postcode === postalCode
        ? { ...current, customFields: { ...current.customFields, custom_field_4: municipio } }
        : current,
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const next = validateAddress(values, config.fields);
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const input = toAddressInput(values, config.fields, original);
      const result =
        addressId === undefined
          ? await createAddressAction({ token, address: input })
          : await updateAddressAction({ token, id: addressId, address: input });
      if (result.status === 'saved') {
        redirectBrowser(ADDRESS_BOOK_PATH);
        return;
      }
      if (result.status === 'not_authorized') {
        onUnauthorized();
        return;
      }
      setFormError(SAVE_ERROR);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(entry: FormField): ReactNode {
    const label = labelOf(entry);
    const error = errors[entry.code];
    const wrapper = (child: ReactNode) => (
      <div key={entry.code} className={cx(entry.width > 50 ? 'sm:col-span-2' : 'sm:col-span-1')}>
        {child}
      </div>
    );
    switch (entry.code) {
      case 'country_id':
        return wrapper(<Input label={label} value={COUNTRY_LABEL} disabled readOnly />);
      case 'telephone':
        return wrapper(
          <Input
            label={label}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            aria-required={entry.required || undefined}
            value={values.telephone}
            onChange={(event) =>
              patch(
                { telephone: sanitizeDigits(event.target.value, TELEPHONE_DIGITS) },
                'telephone',
              )
            }
            error={error}
          />,
        );
      case 'postcode':
        return wrapper(
          <Input
            label={label}
            inputMode="numeric"
            autoComplete="postal-code"
            aria-required={entry.required || undefined}
            value={values.postcode}
            onChange={(event) =>
              patch({ postcode: sanitizeDigits(event.target.value, POSTCODE_DIGITS) }, 'postcode')
            }
            error={error}
          />,
        );
      case 'region':
        return wrapper(
          regions.length > 0 ? (
            <Select
              label={label}
              aria-required={entry.required || undefined}
              value={values.regionId === null ? '' : String(values.regionId)}
              onChange={(event) => {
                const picked = regions.find((region) => String(region.id) === event.target.value);
                patch(
                  picked
                    ? { regionName: picked.name, regionId: picked.id }
                    : { regionName: '', regionId: null },
                  'region',
                );
              }}
              error={error}
            >
              <option value="">Selecciona un estado</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label={label}
              aria-required={entry.required || undefined}
              value={values.regionName}
              onChange={(event) =>
                patch({ regionName: event.target.value, regionId: null }, 'region')
              }
              error={error}
            />
          ),
        );
      case 'custom_field_2': {
        const withoutNumber = values.customFields.custom_field_2 === NO_NUMBER;
        return wrapper(
          <div className="flex flex-col gap-2">
            <Input
              label={label}
              aria-required={entry.required || undefined}
              value={values.customFields.custom_field_2}
              disabled={withoutNumber}
              onChange={(event) => setCustom('custom_field_2', event.target.value)}
              error={error}
            />
            <Checkbox
              label="Sin número"
              checked={withoutNumber}
              onChange={(event) =>
                setCustom('custom_field_2', event.target.checked ? NO_NUMBER : '')
              }
            />
          </div>,
        );
      }
      case 'street':
        return (
          <div key="street" className="flex flex-col gap-3 sm:col-span-2">
            {values.street.map((line, index) =>
              index === 0 && config.googleApiKey ? (
                <StreetAutocomplete
                  key={index}
                  label={label}
                  apiKey={config.googleApiKey}
                  required={entry.required}
                  value={line}
                  onValueChange={(value) => {
                    const lines = [...values.street];
                    lines[0] = value;
                    patch({ street: lines }, 'street');
                  }}
                  onPlace={(components) => void onPlace(components)}
                  error={error}
                />
              ) : (
                <Input
                  key={index}
                  label={index === 0 ? label : undefined}
                  aria-label={index === 0 ? undefined : `${entry.label} ${index + 1}`}
                  aria-required={index === 0 ? entry.required || undefined : undefined}
                  placeholder={index === 0 ? 'Calle y número' : 'Detalles adicionales'}
                  autoComplete={index === 0 ? 'address-line1' : 'address-line2'}
                  value={line}
                  onChange={(event) => {
                    const lines = [...values.street];
                    lines[index] = event.target.value;
                    patch({ street: lines }, 'street');
                  }}
                  error={index === 0 ? error : undefined}
                />
              ),
            )}
          </div>
        );
      case 'firstname':
        return wrapper(
          textInput(
            entry,
            label,
            error,
            values.firstName,
            (value) => patch({ firstName: value }, 'firstname'),
            'given-name',
          ),
        );
      case 'lastname':
        return wrapper(
          textInput(
            entry,
            label,
            error,
            values.lastName,
            (value) => patch({ lastName: value }, 'lastname'),
            'family-name',
          ),
        );
      case 'city':
        return wrapper(
          textInput(
            entry,
            label,
            error,
            values.city,
            (value) => patch({ city: value }, 'city'),
            'address-level2',
          ),
        );
      default: {
        const code: CustomFieldCode | null =
          CUSTOM_FIELD_CODES.find((custom) => custom === entry.code) ?? null;
        if (!code) return null;
        return wrapper(
          textInput(entry, label, error, values.customFields[code], (value) =>
            setCustom(code, value),
          ),
        );
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-ds-text">
        {addressId === undefined ? 'Nueva dirección' : 'Editar dirección'}
      </h1>
      <FormError message={formError} />
      {recipient.length > 0 ? (
        <section aria-labelledby="address-recipient" className="flex flex-col gap-4">
          <h2 id="address-recipient" className="text-lg font-semibold text-ds-text">
            Destinatario
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">{recipient.map(renderField)}</div>
        </section>
      ) : null}
      <section aria-labelledby="address-address" className="flex flex-col gap-4">
        <h2 id="address-address" className="text-lg font-semibold text-ds-text">
          Dirección
        </h2>
        <p className="text-sm text-ds-text-secondary">
          Ingresa tu dirección, después puedes ajustar los datos
        </p>
        <div className="grid gap-4 sm:grid-cols-2">{address.map(renderField)}</div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          Guardar
        </Button>
        <Button href={ADDRESS_BOOK_PATH} variant="tertiary" nativeAnchor>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Admin label with a required marker (legacy red `*`). */
function labelOf(entry: FormField): ReactNode {
  return (
    <>
      {entry.label}
      {entry.required ? (
        <span aria-hidden="true" className="ml-0.5 text-ds-text-error">
          *
        </span>
      ) : null}
    </>
  );
}

function textInput(
  entry: FormField,
  label: ReactNode,
  error: string | undefined,
  value: string,
  onChange: (value: string) => void,
  autoComplete?: string,
): ReactNode {
  return (
    <Input
      label={label}
      aria-required={entry.required || undefined}
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
    />
  );
}
