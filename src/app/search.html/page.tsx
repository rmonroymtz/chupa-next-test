import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SEARCH_PATH } from '@/modules/layout/domain/search';
import { toSearch } from '@/modules/routing/domain/request-path';
import { getRecommendations } from '@/modules/recommendations/infrastructure/recommendations.composition';
import { getSearchPageDecision } from '@/modules/search/infrastructure/search-page.composition';
import { getSearchSortOptions } from '@/modules/search/infrastructure/search.composition';
import { SearchPage } from '@/modules/search/ui/search-page';
import { buildSearchPageMetadata } from '@/modules/search/ui/search-page-metadata';

// Rendered per request; no data cache. No loading.tsx: the store redirect and the
// page state are decided before anything streams; only the sort selector and the
// recommendation sliders stream later.
export const dynamic = 'force-dynamic';

interface SearchRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Metadata needs only the query: no Magento or CHAPI call. */
export async function generateMetadata({ searchParams }: SearchRouteProps): Promise<Metadata> {
  const query = new URLSearchParams(toSearch(await searchParams)).get('query') ?? '';
  return buildSearchPageMetadata(query);
}

export default async function SearchRoute({ searchParams }: SearchRouteProps) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const search = toSearch(params);
  const decision = await getSearchPageDecision(search, requestHeaders.get('user-agent'));
  if (decision.kind === 'redirect') return redirect(decision.location);
  const retryUrl = search ? `${SEARCH_PATH}?${search}` : SEARCH_PATH;
  return (
    <SearchPage
      view={decision}
      retryUrl={retryUrl}
      // Started during render, awaited inside the sort selector's own Suspense boundary.
      loadSortOptions={(listing) =>
        getSearchSortOptions(
          listing.store,
          decision.query,
          listing.filters,
          listing.pageSize,
          listing.result,
        )
      }
      // Called only when the page shows the sliders (never for bots); each one streams.
      loadRecommendations={getRecommendations}
    />
  );
}
