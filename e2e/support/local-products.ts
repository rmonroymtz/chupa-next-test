/** Products the local e2e stack serves (see `local-stack.ts`). */
export const LOCAL_PRODUCTS = {
  magento: {
    routeUrl: 'amazon-B0E2ELAMP1-desk-lamp.html',
    sku: 'B0E2ELAMP1',
  },
  scraped: {
    // Not in Magento: streamed from the scraper fixture (`asin` 126981644035|428130345038).
    path: '/ebay-126981644035-gildan-heavy-cotton-t-shirt.html?var=428130345038',
    chapiKey: 'ebay:126981644035|428130345038',
    sku: '126981644035|428130345038',
  },
} as const;
