import { Suspense } from 'react';
import { TrackEvent } from '@/modules/analytics/ui/track-event.client';
import { SEARCH_STORES } from '@/modules/layout/domain/search';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import {
  RecommendationSliders,
  type RecommendationsLoader,
} from '@/modules/recommendations/ui/recommendation-sliders';
import { searchPageEvents } from '@/modules/search/application/search-analytics';
import {
  showsRecommendations,
  type SearchPageView,
  type StoreListing,
} from '@/modules/search/application/search-page';
import type { SearchLocation } from '@/modules/search/domain/search-links';
import type { SearchResult, SearchSortOption } from '@/modules/search/domain/search-result';
import { ChupaChoiceSection } from './chupachoice-section';
import { SearchFiltersDisclosure, SearchFiltersSidebar } from './search-filters';
import { SearchPagination } from './search-pagination';
import { SearchRequestedEvent } from './search-requested-event.client';
import { SearchSort, SearchSortPlaceholder } from './search-sort';

/** A listing whose search answered. */
export type AnsweredListing = StoreListing & { readonly result: SearchResult };

/**
 * Sort options of a single-store listing with results (the composition's
 * `getSearchSortOptions`). Called during render; its promise streams.
 */
export type SortOptionsLoader = (listing: AnsweredListing) => Promise<readonly SearchSortOption[]>;

interface SearchPageProps {
  readonly view: SearchPageView;
  /** The current url (path and query), linked by "Reintentar". */
  readonly retryUrl: string;
  readonly loadSortOptions: SortOptionsLoader;
  /** Recommendation sliders (`getRecommendations`); none without it. */
  readonly loadRecommendations?: RecommendationsLoader | undefined;
}

/**
 * Search results page (Server Component, plain links, no client JavaScript):
 * either one store (filters, sort, grid, pagination) or the ChupaChoice view
 * (one legacy-styled list per store, `ChupaChoiceSection`). Bots and blank queries get
 * only the heading. The sort selector streams in its own Suspense boundary,
 * so the results never wait for the `sort_by` call. The recommendation
 * sliders (`showsRecommendations`) stream after the results the same way.
 * Analytics events are the only client islands (`searchPageEvents`; single
 * store only).
 */
export function SearchPage({
  view,
  retryUrl,
  loadSortOptions,
  loadRecommendations,
}: SearchPageProps) {
  const { query, results } = view;
  if (results.kind === 'multi') {
    // Legacy ChupaChoice page: site column, uppercase light/bold title, one list per store.
    return (
      <div data-search-store={view.store} className="container-padded">
        <h1 className="text-left text-[20px] leading-[90px] uppercase">
          <span className="font-light">Resultados por tienda:</span>
          <span className="font-bold"> “{query}”</span>
        </h1>
        <div className="mb-4">
          {results.listings.map((listing) => (
            <ChupaChoiceSection
              key={listing.store}
              listing={listing}
              query={query}
              retryUrl={retryUrl}
            />
          ))}
        </div>
      </div>
    );
  }
  const heading = query ? `Resultados para «${query}»` : 'Búsqueda';
  return (
    <div data-search-store={view.store} className="container-padded py-6">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      {results.kind === 'none' && results.reason === 'empty_query' ? (
        <p className="py-12 text-center text-ds-text-secondary">Escribe lo que quieres buscar.</p>
      ) : null}
      {results.kind === 'single' ? (
        <SingleStore
          listing={results.listing}
          view={view}
          retryUrl={retryUrl}
          loadSortOptions={loadSortOptions}
        />
      ) : null}
      {loadRecommendations && showsRecommendations(view) ? (
        <RecommendationSliders load={loadRecommendations} />
      ) : null}
      <SearchEvents view={view} />
    </div>
  );
}

/**
 * The search (keyed by store and query) and the result list (keyed by the
 * response). Keys only matter if a navigation re-renders the page in place;
 * search links are full page loads, so the search event also checks the referrer.
 */
function SearchEvents({ view }: { readonly view: SearchPageView }) {
  const { requested, resultsViewed } = searchPageEvents(view);
  return (
    <>
      {requested ? <SearchRequestedEvent key={requested.key} event={requested.event} /> : null}
      {resultsViewed ? <TrackEvent key={resultsViewed.key} event={resultsViewed.event} /> : null}
    </>
  );
}

function SingleStore({
  listing,
  view,
  retryUrl,
  loadSortOptions,
}: {
  readonly listing: StoreListing;
  readonly view: SearchPageView;
  readonly retryUrl: string;
  readonly loadSortOptions: SortOptionsLoader;
}) {
  const { result } = listing;
  if (listing.failure !== null || result === null) {
    return <ErrorState retryUrl={retryUrl} />;
  }
  if (result.items.length === 0) {
    return (
      <p data-search-state="empty" className="py-12 text-center text-ds-text-secondary">
        No encontramos resultados para «{view.query}».
      </p>
    );
  }

  // CHAPI links belong to the store that answered: following them must ask that store, not the
  // requested one (decided 2026-10-15; the legacy PWA kept the requested store). When that store is
  // not a search store, no link can carry them safely: products only.
  const linkStore = answeringStore(listing, result);
  const location: SearchLocation = { query: view.query, store: linkStore ?? listing.store };
  const hasFilters = linkStore !== null && result.refinements.length > 0;
  // PWA `searchPage.module.css`: the controls row spans the page above the filter column and the
  // results; the 280px filter column (16px gap) starts at 1025px (`max-width: 1024px` stacks it).
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p data-search-count className="text-sm text-ds-text-secondary">
          {productCount(result.items.length)}
        </p>
        {linkStore !== null ? (
          <Suspense fallback={<SearchSortPlaceholder />}>
            <SearchSort
              options={safeSortOptions(loadSortOptions, { ...listing, store: linkStore, result })}
              location={location}
            />
          </Suspense>
        ) : null}
        {hasFilters ? (
          <SearchFiltersDisclosure refinements={result.refinements} location={location} />
        ) : null}
      </div>
      <div
        className={
          hasFilters
            ? 'flex flex-col gap-4 min-[1025px]:grid min-[1025px]:grid-cols-[280px_minmax(0,1fr)]'
            : undefined
        }
      >
        {hasFilters ? (
          <SearchFiltersSidebar refinements={result.refinements} location={location} />
        ) : null}
        <div className="min-w-0">
          {listing.servedByFallback ? (
            <FallbackNotice
              requested={listing.store}
              vendor={result.vendor}
              count={result.items.length}
              query={view.query}
            />
          ) : null}
          {/* The PWA Gallery item shows the brand and the review stars of each result. */}
          <ProductCards cards={result.items} appearance="grid" showRating />
          {linkStore !== null ? (
            <SearchPagination pagination={result.pagination} page={view.page} location={location} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * `totalProducts` means different things per store (amazon: this page's
 * items; eBay: the whole search), so only the items shown are counted.
 */
function productCount(count: number): string {
  return `${count} ${count === 1 ? 'producto' : 'productos'} en esta página`;
}

/** The sort selector must never fail the page: any failure means no options. */
function safeSortOptions(
  load: SortOptionsLoader,
  listing: AnsweredListing,
): Promise<readonly SearchSortOption[]> {
  try {
    return load(listing).catch(() => []);
  } catch {
    return Promise.resolve([]);
  }
}

/** Legacy `BackupStoreMessage`: CHAPI answered from another store. */
function FallbackNotice({
  requested,
  vendor,
  count,
  query,
}: {
  readonly requested: string;
  readonly vendor: string;
  readonly count: number;
  readonly query: string;
}) {
  return (
    <p
      data-search-fallback
      role="status"
      className="mb-4 rounded-xs border border-ds-warning bg-ds-warning-bg px-4 py-3 text-sm"
    >
      <strong>{storeLabel(requested)}</strong> se encuentra en mantenimiento. Sin embargo
      encontramos (<strong>{count}</strong>) resultados para “<strong>{query}</strong>” en{' '}
      <strong>{storeLabel(vendor)}</strong>.
    </p>
  );
}

function ErrorState({ retryUrl }: { readonly retryUrl: string }) {
  return (
    <div role="alert" data-search-state="error" className="py-12 text-center">
      <p className="text-ds-text-secondary">No pudimos cargar los resultados.</p>
      {/* Plain anchor: a full request runs the search again on the server. */}
      <a href={retryUrl} className="mt-2 inline-block font-semibold underline">
        Reintentar
      </a>
    </div>
  );
}

function storeLabel(store: string): string {
  return SEARCH_STORES.find((entry) => entry.id === store)?.label ?? store;
}

/**
 * The store whose CHAPI links a listing carries: the requested store, or the vendor that answered
 * a fallback when it is a search store; null when no search store can follow them.
 */
function answeringStore(listing: StoreListing, result: SearchResult): string | null {
  if (!listing.servedByFallback) return listing.store;
  return SEARCH_STORES.some((entry) => entry.id === result.vendor) ? result.vendor : null;
}
