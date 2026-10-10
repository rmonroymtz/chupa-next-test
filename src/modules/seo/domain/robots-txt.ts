import { siteRootUrl } from '@/modules/seo/domain/site';

/**
 * Rules copied from the production robots.txt (served by Magento/PWA Studio
 * before the storefront), in the same order. Only the Sitemap line is
 * generated: it points at the public base url, where Magento keeps serving
 * the sitemaps.
 */
const RULES = `User-agent: *
Allow: /
############################################
# ZONAS INTERNAS MAGENTO (NO INDEXAR)
############################################
Disallow: /admin/
Disallow: /index.php/
Disallow: /customer/
Disallow: /checkout/
Disallow: /wishlist/
Disallow: /compare/
Disallow: /review/
Disallow: /sendfriend/
Disallow: /newsletter/
Disallow: /sales/
Disallow: /reports/
Disallow: /downloadable/
Disallow: /giftregistry/
Disallow: /paypal/
Disallow: /errors/
Disallow: /cron.php
############################################
# APIs (CRÍTICO EN PWA)
############################################
Disallow: /graphql
Disallow: /rest/
Disallow: /swagger
############################################
# BUSCADOR Y FILTROS (CRAWL BUDGET)
############################################
Disallow: /catalogsearch/
Disallow: /search/
Disallow: /*?*
Disallow: /*&*
Disallow: /*?p=
Disallow: /*?limit=
Disallow: /*?product_list_mode=
Disallow: /*?product_list_order=
Disallow: /*?product_list_dir=
Disallow: /*?utm_
Disallow: /*?gclid=
Disallow: /*?fbclid=
############################################
# ESTÁTICOS
############################################
Allow: /static/
Allow: /static/version
############################################
# MEDIA (IMÁGENES)
############################################
Allow: /media/catalog/product/
Allow: /media/catalog/category/
Allow: /media/logo/
############################################
# SITEMAPS
############################################`;

/** robots.txt body for the given public base url (`PUBLIC_BASE_URL`). */
export function buildRobotsTxt(baseUrl: string): string {
  return `${RULES}\nSitemap: ${siteRootUrl(baseUrl)}sitemap.xml\n`;
}
