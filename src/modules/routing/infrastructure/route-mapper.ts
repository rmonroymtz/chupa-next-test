import type { RouteResolution } from '@/modules/routing/domain/route';

/** `RoutableInterface` fields selected by RESOLVE_ROUTE_QUERY. */
export interface RouteDto {
  type?: 'PRODUCT' | 'CMS_PAGE' | 'CATEGORY' | null;
  redirect_code?: number | null;
  relative_url?: string | null;
  uid?: string | null;
  identifier?: string | null;
}

/**
 * Maps a `route()` result. Redirects win over the entity type; an entity
 * missing its identifier, or an unknown type, is treated as not found.
 */
export function mapRoute(
  route: RouteDto | null | undefined,
  requestedUrl: string,
): RouteResolution {
  if (!route) return { kind: 'not_found' };

  const relativeUrl = route.relative_url || requestedUrl;
  const code = route.redirect_code ?? 0;
  if (code > 0) return { kind: 'redirect', relativeUrl, code };

  switch (route.type) {
    case 'PRODUCT':
      return route.uid ? { kind: 'product', uid: route.uid, relativeUrl } : { kind: 'not_found' };
    case 'CATEGORY':
      return route.uid ? { kind: 'category', uid: route.uid, relativeUrl } : { kind: 'not_found' };
    case 'CMS_PAGE':
      return route.identifier
        ? { kind: 'cms', identifier: route.identifier, relativeUrl }
        : { kind: 'not_found' };
    default:
      return { kind: 'not_found' };
  }
}
