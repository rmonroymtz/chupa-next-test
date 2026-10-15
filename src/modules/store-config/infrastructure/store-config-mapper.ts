import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';
import {
  DEFAULT_GRID_PER_PAGE,
  type StoreConfig,
} from '@/modules/store-config/domain/store-config';

type Nullable<T> = T | null | undefined;

/** Subset of the GraphQL `StoreConfig` type selected by STORE_CONFIG_QUERY. */
export interface StoreConfigDto {
  store_code?: Nullable<string>;
  store_name?: Nullable<string>;
  locale?: Nullable<string>;
  product_url_suffix?: Nullable<string>;
  base_media_url?: Nullable<string>;
  secure_base_media_url?: Nullable<string>;
  base_currency_code?: Nullable<string>;
  default_display_currency_code?: Nullable<string>;
  default_title?: Nullable<string>;
  title_prefix?: Nullable<string>;
  title_suffix?: Nullable<string>;
  title_separator?: Nullable<string>;
  default_description?: Nullable<string>;
  cms_home_page?: Nullable<string>;
  grid_per_page?: Nullable<number>;
  engine_settings?: Nullable<Record<string, Nullable<string>>>;
  service_fallback?: Nullable<Record<string, Nullable<string>>>;
}

const ENGINE_KEY_SUFFIX = '_engine';
const SEARCH_ENGINE_KEY_SUFFIX = '_search_engine';

export function mapStoreConfig(dto: StoreConfigDto): StoreConfig {
  return {
    storeCode: dto.store_code ?? null,
    storeName: dto.store_name ?? null,
    locale: dto.locale ?? null,
    productUrlSuffix: dto.product_url_suffix || DEFAULT_PRODUCT_URL_SUFFIX,
    baseMediaUrl: dto.secure_base_media_url || dto.base_media_url || null,
    baseCurrencyCode: dto.base_currency_code ?? null,
    displayCurrencyCode: dto.default_display_currency_code ?? null,
    defaultTitle: dto.default_title ?? null,
    titlePrefix: dto.title_prefix ?? null,
    titleSuffix: dto.title_suffix ?? null,
    titleSeparator: dto.title_separator ?? null,
    defaultDescription: dto.default_description ?? null,
    cmsHomePage: toCmsHomeIdentifier(dto.cms_home_page),
    gridPerPage: toGridPerPage(dto.grid_per_page),
    engineRouting: {
      engineSettings: pickEngines(
        dto.engine_settings,
        ENGINE_KEY_SUFFIX,
        (key) => !key.endsWith(SEARCH_ENGINE_KEY_SUFFIX),
      ),
      searchEngineSettings: pickEngines(dto.engine_settings, SEARCH_ENGINE_KEY_SUFFIX),
      serviceFallback: Object.fromEntries(
        Object.entries(dto.service_fallback ?? {}).map(([key, value]) => [key, value ?? null]),
      ),
    },
  };
}

/**
 * Engines keyed by store, from the `engine_settings` keys ending in `suffix`
 * (the suffix is stripped: `ebay_search_engine` → `ebay`).
 */
function pickEngines(
  settings: StoreConfigDto['engine_settings'],
  suffix: string,
  accept: (key: string) => boolean = () => true,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(settings ?? {})
      .filter(([key]) => key.endsWith(suffix) && accept(key))
      .map(([key, value]) => [key.slice(0, -suffix.length), value ?? null]),
  );
}

/**
 * Magento stores the home page as `identifier|page_id` when the identifier is
 * not unique across stores (e.g. `venia-new-home|5`); only the identifier is
 * matched against routed CMS pages. Blank means no home page configured.
 */
function toCmsHomeIdentifier(value: Nullable<string>): string | null {
  return value?.split('|', 1)[0]?.trim() || null;
}

/** A positive integer page size, or the default when Magento has none. */
function toGridPerPage(value: Nullable<number>): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_GRID_PER_PAGE;
}
