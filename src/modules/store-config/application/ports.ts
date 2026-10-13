import type { StoreConfig } from '@/modules/store-config/domain/store-config';

export interface StoreConfigRepository {
  /** Rejects when Magento is unavailable (never resolves a partial default). */
  get(): Promise<StoreConfig>;
}
