/**
 * Store-level settings read from Magento `storeConfig`. Pure domain code.
 */

/** Scraper engine settings and per-store service fallback, keyed by store. */
export interface EngineRouting {
  /** Detail-page engine per store (`storeConfig.engine_settings.<store>_engine`). */
  readonly engineSettings: Readonly<Record<string, string | null | undefined>>;
  /**
   * Search engine per store (`storeConfig.engine_settings.<store>_search_engine`).
   * A separate map so search keys never collide with detail-page keys.
   */
  readonly searchEngineSettings: Readonly<Record<string, string | null | undefined>>;
  /** Store whose engine serves each store (`storeConfig.service_fallback.<store>`). */
  readonly serviceFallback: Readonly<Record<string, string | null | undefined>>;
}

/** Category page size when `storeConfig.grid_per_page` is unset (Magento's default grid size). */
export const DEFAULT_GRID_PER_PAGE = 12;

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
  /** Identifier of the CMS page Magento serves as the home (`cms_home_page`); null when unset. */
  readonly cmsHomePage: string | null;
  /**
   * Products per category listing page (`grid_per_page`);
   * {@link DEFAULT_GRID_PER_PAGE} when Magento returns no positive integer.
   */
  readonly gridPerPage: number;
  readonly engineRouting: EngineRouting;
}

/**
 * Scraper `engine_id` for a store, replicating the legacy storefront:
 * `engine_settings[service_fallback[store] + '_engine']`. Returns null when
 * the store has no fallback or the fallback store has no engine.
 */
export function resolveEngineId(store: string, routing: EngineRouting): string | null {
  return resolveFromFallback(store, routing, routing.engineSettings);
}

/**
 * Scraper search `engine_id` for a store, replicating the legacy storefront:
 * `engine_settings[service_fallback[store] + '_search_engine']`. Returns null
 * when the store has no fallback (e.g. `chupachoice` or an unknown store) or
 * the fallback store has no search engine; callers decide what to do then.
 */
export function resolveSearchEngineId(store: string, routing: EngineRouting): string | null {
  return resolveFromFallback(store, routing, routing.searchEngineSettings);
}

function resolveFromFallback(
  store: string,
  routing: EngineRouting,
  engines: EngineRouting['engineSettings'],
): string | null {
  const fallback = routing.serviceFallback[store.toLowerCase()]?.trim().toLowerCase();
  if (!fallback) return null;
  const engine = engines[fallback]?.trim();
  return engine ? engine : null;
}
