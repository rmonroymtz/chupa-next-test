import type { RouteResolution } from '@/modules/routing/domain/route';
import { usableRedirectTarget } from '@/modules/routing/domain/redirect-target';

/** `RoutableInterface` fields selected by RESOLVE_ROUTE_QUERY. */
export interface RouteDto {
  type?: 'PRODUCT' | 'CMS_PAGE' | 'CATEGORY' | null;
  redirect_code?: number | null;
  relative_url?: string | null;
  uid?: string | null;
  identifier?: string | null;
}

/**
 * Maps a `route()` result. Redirects win over the entity type, except a
 * redirect without a usable target (empty, or the requested url itself),
 * which is ignored so the entity resolves normally. An entity missing its
 * identifier, or an unknown type, is treated as not found.
 */
export function mapRoute(
  route: RouteDto | null | undefined,
  requestedUrl: string,
): RouteResolution {
  if (!route) return { kind: 'not_found' };

  const code = route.redirect_code ?? 0;
  const redirectTarget = code > 0 ? usableRedirectTarget(route.relative_url, requestedUrl) : null;
  if (redirectTarget !== null) return { kind: 'redirect', relativeUrl: redirectTarget, code };

  // A self-redirect's relative_url may be empty or encoded: keep the requested url.
  const relativeUrl = (code > 0 ? null : route.relative_url) || requestedUrl;

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
