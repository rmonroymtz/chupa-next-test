import 'server-only';
import {
  AddressGatewayError,
  type AddressGateway,
  type AddressGatewayErrorKind,
  type AddressInput,
  type CustomerAddress,
  type RawFormConfig,
  type RegionOption,
} from '@/modules/address/application/ports';
import { CUSTOM_FIELD_CODES } from '@/modules/address/domain/address';
import {
  CREATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  FORM_CONFIG_QUERY,
  LIST_ADDRESSES_QUERY,
  REGIONS_QUERY,
  SEPOMEX_QUERY,
  UPDATE_ADDRESS_MUTATION,
} from '@/modules/address/infrastructure/address.queries';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

const NOT_AUTHORIZED_MESSAGES = ["The current customer isn't authorized", 'not authorized'];

function classify(caught: unknown): AddressGatewayErrorKind {
  if (
    caught instanceof MagentoRequestError &&
    caught.kind === 'graphql' &&
    caught.graphqlMessages.some((message) =>
      NOT_AUTHORIZED_MESSAGES.some((fragment) => message.includes(fragment)),
    )
  ) {
    return 'not_authorized';
  }
  return 'failure';
}

type Raw = Record<string, unknown>;
const asRecord = (value: unknown): Raw | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null;
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function mapAddress(raw: unknown): CustomerAddress | null {
  const address = asRecord(raw);
  const id = asNumber(address?.id);
  if (!address || id === null) return null;
  const region = asRecord(address.region);
  const attributes = new Map<string, string>();
  if (Array.isArray(address.custom_attributes)) {
    for (const entry of address.custom_attributes) {
      const attribute = asRecord(entry);
      // The legacy drops empty values and the "-" placeholder Magento stores for blanks.
      const value = asString(attribute?.value);
      if (attribute) attributes.set(asString(attribute.attribute_code), value === '-' ? '' : value);
    }
  }
  return {
    id,
    firstName: asString(address.firstname),
    middleName: asString(address.middlename),
    lastName: asString(address.lastname),
    street: Array.isArray(address.street) ? address.street.map(asString) : [],
    city: asString(address.city),
    postcode: asString(address.postcode),
    countryCode: asString(address.country_code),
    region: {
      name: asString(region?.region),
      code: asString(region?.region_code) || null,
      id: asNumber(region?.region_id),
    },
    telephone: asString(address.telephone),
    defaultShipping: address.default_shipping === true,
    defaultBilling: address.default_billing === true,
    customFields: Object.fromEntries(
      CUSTOM_FIELD_CODES.map((code) => [code, attributes.get(code) ?? '']),
    ) as CustomerAddress['customFields'],
  };
}

/** `CustomerAddressInput` as the legacy form sends it (`country_id`, `region`, `custom_attributes`). */
function toMagentoInput(address: AddressInput): Record<string, unknown> {
  const { name, id } = address.region;
  return {
    firstname: address.firstName,
    middlename: address.middleName,
    lastname: address.lastName,
    street: address.street,
    city: address.city,
    postcode: address.postcode,
    country_id: address.countryId,
    region: { ...(name ? { region: name } : {}), ...(id !== null ? { region_id: id } : {}) },
    telephone: address.telephone,
    custom_attributes: CUSTOM_FIELD_CODES.flatMap((code) => {
      const value = address.customFields[code];
      return value === undefined ? [] : [{ attribute_code: code, value }];
    }),
  };
}

/**
 * Magento address adapter. The customer token only travels in the
 * `Authorization` header; the client logs no variables or headers and errors
 * carry only the operation name (addresses are personal data).
 */
export function createMagentoAddressGateway(client: MagentoClient): AddressGateway {
  async function call<TData>(
    operationName: string,
    query: string,
    variables: Record<string, unknown>,
    token: string | null,
  ): Promise<TData> {
    try {
      return await client.request<TData>({
        operationName,
        query,
        variables,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
    } catch (caught) {
      throw new AddressGatewayError(classify(caught), `Magento ${operationName} failed`, {
        cause: caught,
      });
    }
  }

  return {
    async listAddresses(token) {
      const data = await call<{ customer: { addresses?: unknown } | null } | null>(
        'GetCustomerAddressesForAddressBook',
        LIST_ADDRESSES_QUERY,
        {},
        token,
      );
      const addresses = data?.customer?.addresses;
      if (!Array.isArray(addresses)) {
        throw new AddressGatewayError('failure', 'Magento address list returned no customer');
      }
      return addresses.flatMap((raw) => {
        const mapped = mapAddress(raw);
        return mapped ? [mapped] : [];
      });
    },

    async createAddress(token, address) {
      const data = await call<{ createCustomerAddress: { id?: unknown } | null } | null>(
        'AddNewCustomerAddressToAddressBook',
        CREATE_ADDRESS_MUTATION,
        { address: toMagentoInput(address) },
        token,
      );
      if (asNumber(data?.createCustomerAddress?.id) === null) {
        throw new AddressGatewayError('failure', 'Magento createCustomerAddress returned no id');
      }
    },

    async updateAddress(token, id, address) {
      const data = await call<{ updateCustomerAddress: { id?: unknown } | null } | null>(
        'UpdateCustomerAddressInAddressBook',
        UPDATE_ADDRESS_MUTATION,
        { addressId: id, updated_address: toMagentoInput(address) },
        token,
      );
      if (asNumber(data?.updateCustomerAddress?.id) === null) {
        throw new AddressGatewayError('failure', 'Magento updateCustomerAddress returned no id');
      }
    },

    async deleteAddress(token, id) {
      const data = await call<{ deleteCustomerAddress: unknown } | null>(
        'DeleteCustomerAddressFromAddressBook',
        DELETE_ADDRESS_MUTATION,
        { addressId: id },
        token,
      );
      if (data?.deleteCustomerAddress !== true) {
        throw new AddressGatewayError('failure', 'Magento deleteCustomerAddress did not confirm');
      }
    },

    async getRegions(countryCode) {
      const data = await call<{ country: { available_regions?: unknown } | null } | null>(
        'GetRegions',
        REGIONS_QUERY,
        { countryCode },
        null,
      );
      const regions = data?.country?.available_regions;
      if (!Array.isArray(regions)) return [];
      return regions.flatMap((entry): RegionOption[] => {
        const region = asRecord(entry);
        const id = asNumber(region?.id);
        const code = asString(region?.code);
        const name = asString(region?.name);
        return id !== null && name !== '' ? [{ id, code, name }] : [];
      });
    },

    async getSepomexMunicipio(postalCode) {
      const data = await call<{ getSepomexData: { municipio?: unknown } | null } | null>(
        'getSepomexData',
        SEPOMEX_QUERY,
        { postal_code: postalCode },
        null,
      );
      return asString(data?.getSepomexData?.municipio) || null;
    },

    async getFormConfig() {
      const data = await call<{ storeConfig: Raw | null } | null>(
        'AddressFormConfig',
        FORM_CONFIG_QUERY,
        {},
        null,
      );
      const config = data?.storeConfig;
      return {
        fieldsJson:
          asString(
            asRecord(config?.amasty_checkout_manage_checkout_fields)
              ?.amasty_checkout_checkout_fields,
          ) || null,
        streetLines: asNumber(config?.amasty_checkout_customer_address_street_lines),
        googleSuggestions: config?.amasty_checkout_geolocation_google_address_suggestion === true,
        googleApiKey: asString(config?.amasty_checkout_geolocation_google_api_key).trim() || null,
      } satisfies RawFormConfig;
    },
  };
}
