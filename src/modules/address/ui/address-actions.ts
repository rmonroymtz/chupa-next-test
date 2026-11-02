'use server';

import {
  deleteAddressInputSchema,
  listAddressesInputSchema,
  postcodeInputSchema,
  regionsInputSchema,
  saveAddressInputSchema,
  updateAddressInputSchema,
} from '@/modules/address/application/address-input';
import type {
  ChangeAddressResult,
  ListAddressesResult,
  RegionsResult,
  SepomexResult,
} from '@/modules/address/application/address-service';
import type { AddressFormConfig } from '@/modules/address/application/ports';
import { DEFAULT_FIELDS } from '@/modules/address/domain/address';
import { getAddressService } from '@/modules/address/infrastructure/address.composition';
import { getLogger } from '@/shared/observability/logger';

/**
 * Address Server Actions: the only way the browser reaches Magento for the
 * address book (no `/api/*` route; that prefix belongs to the scraper API at the
 * edge). Tokens and address data are never logged. Nothing is cached.
 */

export async function listAddressesAction(input: unknown): Promise<ListAddressesResult> {
  const parsed = listAddressesInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('list_addresses');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().list(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function createAddressAction(input: unknown): Promise<ChangeAddressResult> {
  const parsed = saveAddressInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('create_address');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().create(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function updateAddressAction(input: unknown): Promise<ChangeAddressResult> {
  const parsed = updateAddressInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('update_address');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().update(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function deleteAddressAction(input: unknown): Promise<ChangeAddressResult> {
  const parsed = deleteAddressInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('delete_address');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().remove(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function getRegionsAction(input: unknown): Promise<RegionsResult> {
  const parsed = regionsInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('get_regions');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().regions(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function getSepomexAction(input: unknown): Promise<SepomexResult> {
  const parsed = postcodeInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('get_sepomex');
    return { status: 'failed' };
  }
  try {
    return await getAddressService().sepomex(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

/** Never fails: the default Mexican form (no Google) when the service cannot answer. */
export async function getAddressFormConfigAction(): Promise<AddressFormConfig> {
  try {
    return await getAddressService().formConfig();
  } catch {
    return { fields: DEFAULT_FIELDS, streetLines: 2, googleApiKey: null };
  }
}

/** Logs only the action name: the rejected input holds a token and personal data. */
function warnInvalidInput(action: string): void {
  try {
    getLogger().child({ component: 'address' }).warn({ action }, 'invalid address action input');
  } catch {
    // Logging is best effort.
  }
}
