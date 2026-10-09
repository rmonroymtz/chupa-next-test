/**
 * Outcome of resolving a storefront URL with Magento `route()`.
 *
 * `not_found` means Magento answered and has no entity for the URL. A Magento
 * failure is never a `not_found`: resolvers reject instead.
 */
export type RouteResolution =
  | { readonly kind: 'product'; readonly uid: string; readonly relativeUrl: string }
  | { readonly kind: 'cms'; readonly identifier: string; readonly relativeUrl: string }
  | { readonly kind: 'category'; readonly uid: string; readonly relativeUrl: string }
  | { readonly kind: 'redirect'; readonly relativeUrl: string; readonly code: number }
  | { readonly kind: 'not_found' };
