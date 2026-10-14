export const SCRAPER_STORES = ['acme', 'amazon', 'ebay', 'homedepot', 'target', 'walmart'] as const;

export const STORE_CONFIG_QUERY = /* GraphQL */ `
  query StoreConfig {
    storeConfig {
      store_code
      store_name
      locale
      product_url_suffix
      base_media_url
      secure_base_media_url
      base_currency_code
      default_display_currency_code
      default_title
      title_prefix
      title_suffix
      title_separator
      default_description
      cms_home_page
      grid_per_page
      engine_settings {
        acme_engine
        amazon_engine
        ebay_engine
        homedepot_engine
        target_engine
        walmart_engine
      }
      service_fallback {
        acme
        amazon
        ebay
        homedepot
        target
        walmart
      }
    }
  }
`;
