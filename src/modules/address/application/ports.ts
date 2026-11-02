import type { CustomFieldCode, FormField } from '@/modules/address/domain/address';

export interface AddressRegion {
  readonly name: string;
  readonly code: string | null;
  readonly id: number | null;
}

/** A saved address (legacy `CustomerAddressBookAddressFragment`). */
export interface CustomerAddress {
  readonly id: number;
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly street: readonly string[];
  readonly city: string;
  readonly postcode: string;
  readonly countryCode: string;
  readonly region: AddressRegion;
  readonly telephone: string;
  readonly defaultShipping: boolean;
  readonly defaultBilling: boolean;
  /** `custom_field_1` second surname, `_2` number ("S/N"), `_3` colonia, `_4` municipio. */
  readonly customFields: Readonly<Record<CustomFieldCode, string>>;
}

/** What the form sends. `region.id` is the Magento region when the shopper picked one. */
export interface AddressInput {
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly street: readonly string[];
  readonly city: string;
  readonly postcode: string;
  readonly countryId: string;
  readonly region: { readonly name: string; readonly id: number | null };
  readonly telephone: string;
  /** Only the custom attributes the form has; `undefined` (zod optional) means not sent. */
  readonly customFields: { readonly [K in CustomFieldCode]?: string | undefined };
}

export interface RegionOption {
  readonly id: number;
  readonly code: string;
  readonly name: string;
}

/** What the gateway reads from `storeConfig` (Amasty); parsed by the service. */
export interface RawFormConfig {
  readonly fieldsJson: string | null;
  readonly streetLines: number | null;
  readonly googleSuggestions: boolean;
  readonly googleApiKey: string | null;
}

/** What the form renders. The Google key is only set when suggestions are enabled. */
export interface AddressFormConfig {
  readonly fields: readonly FormField[];
  readonly streetLines: number;
  readonly googleApiKey: string | null;
}

export type AddressGatewayErrorKind = 'not_authorized' | 'failure';

export class AddressGatewayError extends Error {
  override readonly name = 'AddressGatewayError';
  constructor(
    readonly kind: AddressGatewayErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Magento address operations. Every method rejects with an {@link AddressGatewayError}. */
export interface AddressGateway {
  listAddresses(token: string): Promise<readonly CustomerAddress[]>;
  createAddress(token: string, address: AddressInput): Promise<void>;
  updateAddress(token: string, id: number, address: AddressInput): Promise<void>;
  deleteAddress(token: string, id: number): Promise<void>;
  /** Public: the regions Magento lists for a country (empty when it lists none). */
  getRegions(countryCode: string): Promise<readonly RegionOption[]>;
  /** Public: the municipio SEPOMEX knows for a postal code. */
  getSepomexMunicipio(postalCode: string): Promise<string | null>;
  getFormConfig(): Promise<RawFormConfig>;
}
