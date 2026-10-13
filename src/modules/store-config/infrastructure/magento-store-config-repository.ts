import 'server-only';
import { cache } from 'react';
import type { StoreConfigRepository } from '@/modules/store-config/application/ports';
import {
  mapStoreConfig,
  type StoreConfigDto,
} from '@/modules/store-config/infrastructure/store-config-mapper';
import { STORE_CONFIG_QUERY } from '@/modules/store-config/infrastructure/store-config.query';
import { getMagentoClient, MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

interface StoreConfigData {
  storeConfig: StoreConfigDto | null;
}

export function createMagentoStoreConfigRepository(client: MagentoClient): StoreConfigRepository {
  return {
    async get() {
      const data = await client.request<StoreConfigData>({
        operationName: 'StoreConfig',
        query: STORE_CONFIG_QUERY,
        variables: {},
      });
      if (!data.storeConfig) {
        throw new MagentoRequestError({
          kind: 'invalid_response',
          operation: 'StoreConfig',
          message: 'Magento returned a null storeConfig',
        });
      }
      return mapStoreConfig(data.storeConfig);
    },
  };
}

/**
 * Store config for the current request. React `cache()` deduplicates calls
 * within a single server render only; nothing is shared across requests, so
 * every request still reads fresh values from Magento.
 */
export const getStoreConfig = cache(() =>
  createMagentoStoreConfigRepository(getMagentoClient()).get(),
);
