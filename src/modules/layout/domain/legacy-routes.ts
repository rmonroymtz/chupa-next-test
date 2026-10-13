/**
 * Routes still served by PWA Studio during the migration (same domain).
 *
 * Links to them must be plain `<a href>` elements, never `next/link`: a full
 * document navigation lets the CDN/nginx path routing hand the request to PWA
 * Studio, and avoids Next prefetching (and RSC-fetching) pages it does not
 * own. Same decision as the PDP and Page Builder product links (T4/T6).
 */
export const LEGACY_ROUTES = {
  home: '/',
  signIn: '/sign-in',
  cart: '/cart',
} as const;
