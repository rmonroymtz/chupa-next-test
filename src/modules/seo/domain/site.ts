/** Brand used in titles, Open Graph and structured data. */
export const SITE_NAME = 'Chupaprecios';
export const OG_LOCALE = 'es_MX';
export const SITE_LANGUAGE = 'es-MX';

/** Legacy search page (PWA Studio) used for site search. */
export const SEARCH_PATH = '/search.html';

/** Site root as an absolute url with a trailing slash. */
export function siteRootUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/`;
}
