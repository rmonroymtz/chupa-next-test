import type { HomePageSource } from '@/modules/cms/application/ports';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { HOME_PATHNAME } from '@/modules/routing/domain/request-path';

/**
 * How a CMS page resolved by Magento `route()` is served:
 * - `home`: requested at `/` (Magento resolves the root to its home page);
 * - `redirect_home`: the home page's own url, permanently redirected to `/`;
 * - `page`: any other CMS page.
 */
export type CmsPageRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'redirect_home'; readonly location: typeof HOME_PATHNAME }
  | { readonly kind: 'page' };

/** A CMS page route that renders the page (anything but the redirect). */
export type ServedCmsPageRoute = Exclude<CmsPageRoute, { readonly kind: 'redirect_home' }>;

export interface CmsPageRequest {
  /** Request pathname as built by `toPathname`. */
  readonly pathname: string;
  /** CMS identifier Magento resolved the pathname to. */
  readonly identifier: string;
}

/**
 * Decides how a Magento-routed CMS page is served. The home page identifier is
 * only read for urls other than `/`; a failure to read it rejects (5xx), so an
 * outage is never served as a duplicate of the home or as a 404.
 */
export async function resolveCmsPageRoute(
  { pathname, identifier }: CmsPageRequest,
  home: HomePageSource,
): Promise<CmsPageRoute> {
  if (pathname === HOME_PATHNAME) return { kind: 'home' };
  const homeIdentifier = await home.getHomeIdentifier();
  return homeIdentifier !== null && identifier === homeIdentifier
    ? { kind: 'redirect_home', location: HOME_PATHNAME }
    : { kind: 'page' };
}

/**
 * Canonical path (no leading slash) of a served CMS page. The home is always
 * the site root, never its Magento relative url (e.g. `venia-new-home`).
 */
export function cmsCanonicalPath(page: CmsPage, route: ServedCmsPageRoute): string {
  return route.kind === 'home' ? '' : page.relativeUrl;
}
