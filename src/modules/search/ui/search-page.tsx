import { Suspense } from 'react';
import { SEARCH_STORES } from '@/modules/layout/domain/search';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type { SearchPageDecision, StoreListing } from '@/modules/search/application/search-page';
import { storeTabHref, type SearchLocation } from '@/modules/search/domain/search-links';
import type { SearchResult, SearchSortOption } from '@/modules/search/domain/search-result';
import { SearchFiltersDisclosure, SearchFiltersSidebar } from './search-filters';
import { SearchPagination } from './search-pagination';
import { SearchSort, SearchSortPlaceholder } from './search-sort';

type SearchPageView = Extract<SearchPageDecision, { kind: 'page' }>;

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
}

/**
 * Search results page (Server Component, plain links, no client JavaScript):
 * store tabs, then either one store (filters, sort, grid, pagination) or the
 * ChupaChoice view (one short list per store). Bots and blank queries get
 * only the heading. The sort selector streams in its own Suspense boundary,
 * so the results never wait for the `sort_by` call.
 */
export function SearchPage({ view, retryUrl, loadSortOptions }: SearchPageProps) {
  const { query, results } = view;
  const heading =
    results.kind === 'multi'
      ? `Resultados por tienda: “${query}”`
      : query
        ? `Resultados para «${query}»`
        : 'Búsqueda';
  return (
    <div data-search-store={view.store} className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      {results.kind === 'none' && results.reason === 'empty_query' ? (
        <p className="py-12 text-center text-neutral-grey">Escribe lo que quieres buscar.</p>
      ) : null}
      {results.kind === 'single' ? (
        <SingleStore
          listing={results.listing}
          view={view}
          retryUrl={retryUrl}
          loadSortOptions={loadSortOptions}
        />
      ) : null}
      {results.kind === 'multi'
        ? results.listings.map((listing) => (
            <StoreSection key={listing.store} listing={listing} query={query} retryUrl={retryUrl} />
          ))
        : null}
    </div>
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
      <p data-search-state="empty" className="py-12 text-center text-neutral-grey">
        No encontramos resultados para «{view.query}».
      </p>
    );
  }

  const location: SearchLocation = { query: view.query, store: listing.store };
  const hasFilters = result.refinements.length > 0;
  return (
    <div
      className={`mt-6 ${hasFilters ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8' : ''}`}
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p data-search-count className="text-sm text-neutral-grey">
            {productCount(result.items.length)}
          </p>
          <Suspense fallback={<SearchSortPlaceholder />}>
            <SearchSort
              options={safeSortOptions(loadSortOptions, { ...listing, result })}
              location={location}
            />
          </Suspense>
          {hasFilters ? (
            <SearchFiltersDisclosure refinements={result.refinements} location={location} />
          ) : null}
        </div>
        <ProductCards cards={result.items} appearance="grid" />
        <SearchPagination pagination={result.pagination} page={view.page} location={location} />
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
      className="mb-4 rounded border border-brand-yellow bg-feedback-warning/40 px-4 py-3 text-sm"
    >
      <strong>{storeLabel(requested)}</strong> se encuentra en mantenimiento. Sin embargo
      encontramos (<strong>{count}</strong>) resultados para “<strong>{query}</strong>” en{' '}
      <strong>{storeLabel(vendor)}</strong>.
    </p>
  );
}

function StoreSection({
  listing,
  query,
  retryUrl,
}: {
  readonly listing: StoreListing;
  readonly query: string;
  readonly retryUrl: string;
}) {
  const { result } = listing;
  const hasItems = listing.failure === null && result !== null && result.items.length > 0;
  return (
    <section
      data-search-section={listing.store}
      aria-labelledby={`search-${listing.store}`}
      className="mt-8"
    >
      <div className="flex items-center justify-between gap-4 border-b border-neutral-inactive pb-2">
        <h2 id={`search-${listing.store}`} className="text-xl font-semibold">
          {storeLabel(listing.store)}
        </h2>
        {hasItems ? (
          <a
            href={storeTabHref(query, listing.store)}
            className="text-sm font-semibold whitespace-nowrap text-brand-red hover:underline"
          >
            Ver más en {storeLabel(listing.store)}
          </a>
        ) : null}
      </div>
      <div className="mt-4">
        {listing.failure !== null || result === null ? (
          <ErrorState retryUrl={retryUrl} />
        ) : result.items.length === 0 ? (
          <p data-search-state="empty" className="py-8 text-center text-neutral-grey">
            Esta tienda no tiene ninguna coincidencia para «{query}».
          </p>
        ) : (
          <ProductCards cards={result.items} appearance="grid" />
        )}
      </div>
    </section>
  );
}

function ErrorState({ retryUrl }: { readonly retryUrl: string }) {
  return (
    <div role="alert" data-search-state="error" className="py-12 text-center">
      <p className="text-neutral-grey">No pudimos cargar los resultados.</p>
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
