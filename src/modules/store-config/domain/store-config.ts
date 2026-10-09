/**
 * Store-level settings read from Magento `storeConfig`. Pure domain code.
 */

/** Scraper engine settings and per-store service fallback, keyed by store. */
export interface EngineRouting {
  /** Detail-page engine per store (`storeConfig.engine_settings.<store>_engine`). */
  readonly engineSettings: Readonly<Record<string, string | null | undefined>>;
  /** Store whose engine serves each store (`storeConfig.service_fallback.<store>`). */
  readonly serviceFallback: Readonly<Record<string, string | null | undefined>>;
}

export interface StoreConfig {
  readonly storeCode: string | null;
  readonly storeName: string | null;
  /** Magento locale, e.g. `es_MX`. */
  readonly locale: string | null;
  /** Product URL suffix including the dot; `.html` when unset. */
  readonly productUrlSuffix: string;
  readonly baseMediaUrl: string | null;
  readonly baseCurrencyCode: string | null;
  readonly displayCurrencyCode: string | null;
  readonly defaultTitle: string | null;
  readonly titlePrefix: string | null;
  readonly titleSuffix: string | null;
  readonly titleSeparator: string | null;
  readonly defaultDescription: string | null;
  readonly engineRouting: EngineRouting;
}

/**
 * Scraper `engine_id` for a store, replicating the legacy storefront:
 * `engine_settings[service_fallback[store] + '_engine']`. Returns null when
 * the store has no fallback or the fallback store has no engine.
 */
export function resolveEngineId(store: string, routing: EngineRouting): string | null {
  const fallback = routing.serviceFallback[store.toLowerCase()]?.trim().toLowerCase();
  if (!fallback) return null;
  const engine = routing.engineSettings[fallback]?.trim();
  return engine ? engine : null;
}
