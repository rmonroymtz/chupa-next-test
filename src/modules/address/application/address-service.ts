import type { Logger } from 'pino';
import {
  AddressGatewayError,
  type AddressFormConfig,
  type AddressGateway,
  type AddressInput,
  type CustomerAddress,
  type RegionOption,
} from '@/modules/address/application/ports';
import { DEFAULT_FIELDS, parseFormFields } from '@/modules/address/domain/address';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export type ListAddressesResult =
  | { readonly status: 'ok'; readonly addresses: readonly CustomerAddress[] }
  | { readonly status: 'not_authorized' }
  | { readonly status: 'failed' };

export type ChangeAddressResult =
  | { readonly status: 'saved' }
  | { readonly status: 'not_authorized' }
  | { readonly status: 'failed' };

export type RegionsResult =
  | { readonly status: 'ok'; readonly regions: readonly RegionOption[] }
  | { readonly status: 'failed' };

export type SepomexResult =
  { readonly status: 'ok'; readonly municipio: string | null } | { readonly status: 'failed' };

export interface AddressService {
  list(command: { readonly token: string }): Promise<ListAddressesResult>;
  create(command: {
    readonly token: string;
    readonly address: AddressInput;
  }): Promise<ChangeAddressResult>;
  update(command: {
    readonly token: string;
    readonly id: number;
    readonly address: AddressInput;
  }): Promise<ChangeAddressResult>;
  remove(command: { readonly token: string; readonly id: number }): Promise<ChangeAddressResult>;
  regions(command: { readonly countryCode: string }): Promise<RegionsResult>;
  sepomex(command: { readonly postalCode: string }): Promise<SepomexResult>;
  /** Never fails: without a usable Magento config it answers the default Mexican form, no Google. */
  formConfig(): Promise<AddressFormConfig>;
}

export interface AddressServiceDeps {
  readonly gateway: AddressGateway;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

const DEFAULT_STREET_LINES = 2;
const MAX_STREET_LINES = 5;

/**
 * Address use cases behind the Server Actions. Tokens and address data (names,
 * phones, streets) are never logged: only the operation and the error kind.
 */
export function createAddressService({
  gateway,
  logger,
  metrics,
}: AddressServiceDeps): AddressService {
  const kindOf = (caught: unknown) =>
    caught instanceof AddressGatewayError ? caught.kind : ('failure' as const);

  async function change(
    operation: 'create' | 'update' | 'delete',
    run: () => Promise<void>,
  ): Promise<ChangeAddressResult> {
    try {
      await run();
      metrics.emitMetric({
        name: 'AddressChange',
        value: 1,
        dimensions: { Operation: operation, Outcome: 'saved' },
      });
      return { status: 'saved' };
    } catch (caught) {
      const kind = kindOf(caught);
      const outcome = kind === 'not_authorized' ? 'not_authorized' : 'failed';
      metrics.emitMetric({
        name: 'AddressChange',
        value: 1,
        dimensions: { Operation: operation, Outcome: outcome },
      });
      logger.warn({ operation, kind }, 'address change failed');
      return { status: outcome };
    }
  }

  return {
    async list({ token }) {
      try {
        return { status: 'ok', addresses: await gateway.listAddresses(token) };
      } catch (caught) {
        const kind = kindOf(caught);
        if (kind === 'not_authorized') return { status: 'not_authorized' };
        logger.warn({ kind }, 'address list failed');
        return { status: 'failed' };
      }
    },

    create: ({ token, address }) => change('create', () => gateway.createAddress(token, address)),
    update: ({ token, id, address }) =>
      change('update', () => gateway.updateAddress(token, id, address)),
    remove: ({ token, id }) => change('delete', () => gateway.deleteAddress(token, id)),

    async regions({ countryCode }) {
      try {
        return { status: 'ok', regions: await gateway.getRegions(countryCode) };
      } catch {
        logger.warn('address regions read failed');
        return { status: 'failed' };
      }
    },

    async sepomex({ postalCode }) {
      try {
        return { status: 'ok', municipio: await gateway.getSepomexMunicipio(postalCode) };
      } catch {
        // The lookup only fills the municipio: the shopper types it when it is missing.
        return { status: 'failed' };
      }
    },

    async formConfig() {
      try {
        const raw = await gateway.getFormConfig();
        const key = raw.googleApiKey?.trim() ?? '';
        const lines = raw.streetLines ?? DEFAULT_STREET_LINES;
        return {
          fields: parseFormFields(raw.fieldsJson),
          streetLines: Math.min(MAX_STREET_LINES, Math.max(1, Math.trunc(lines))),
          googleApiKey: raw.googleSuggestions && key !== '' ? key : null,
        };
      } catch {
        logger.warn('address form config read failed, using the defaults');
        return { fields: DEFAULT_FIELDS, streetLines: DEFAULT_STREET_LINES, googleApiKey: null };
      }
    },
  };
}
