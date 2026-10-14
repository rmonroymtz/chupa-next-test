import {
  cmsCanonicalPath,
  resolveCmsPageRoute,
  type CmsPageRequest,
} from '@/modules/cms/application/home-page';
import type {
  CmsPageOverrides,
  CmsPageRepository,
  HomePageSource,
} from '@/modules/cms/application/ports';
import type { CmsPage } from '@/modules/cms/domain/cms-page';

/**
 * What the catch-all serves for a Magento-routed CMS page:
 * - `redirect_home`: the configured home page's own url (permanent redirect);
 * - `not_found`: Magento routed the url but has no such (enabled) page;
 * - `page`: the Magento page with its canonical path, rendered by the
 *   registered Next component (`override`) or, when none is, by its Magento
 *   content.
 */
export type CmsPageView<TOverride> =
  | { readonly kind: 'redirect_home'; readonly location: string }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'page';
      readonly page: CmsPage;
      /** Canonical path (no leading slash); `''` for the home. */
      readonly canonicalPath: string;
      readonly override: TOverride | null;
    };

export interface CmsPageViewDeps<TOverride> {
  readonly pages: CmsPageRepository;
  readonly home: HomePageSource;
  readonly overrides: CmsPageOverrides<TOverride>;
}

/**
 * Decides how a Magento-routed CMS page is served. Magento keeps the redirect,
 * the 404 and the page data (metadata, canonical) whether or not a Next
 * component overrides its content. Rejects when Magento fails (5xx, never 404).
 */
export async function resolveCmsPageView<TOverride>(
  request: CmsPageRequest,
  { pages, home, overrides }: CmsPageViewDeps<TOverride>,
): Promise<CmsPageView<TOverride>> {
  const route = await resolveCmsPageRoute(request, home);
  if (route.kind === 'redirect_home') return route;
  const page = await pages.findByIdentifier(request.identifier);
  if (!page) return { kind: 'not_found' };
  return {
    kind: 'page',
    page,
    canonicalPath: cmsCanonicalPath(page, route),
    override: overrides.find(request.identifier),
  };
}

/** Overrides backed by a Map, so inherited object keys (e.g. `constructor`) never match. */
export function createCmsPageOverrides<TOverride>(
  registry: ReadonlyMap<string, TOverride>,
): CmsPageOverrides<TOverride> {
  return { find: (identifier) => registry.get(identifier) ?? null };
}
