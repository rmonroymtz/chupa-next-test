import { SEARCH_STORES } from '@/modules/layout/domain/search';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type { SearchPageDecision, StoreListing } from '@/modules/search/application/search-page';

type SearchPageView = Extract<SearchPageDecision, { kind: 'page' }>;

interface SearchPageProps {
  readonly view: SearchPageView;
  /** The current url (path and query), linked by "Reintentar". */
  readonly retryUrl: string;
}

/**
 * Search results page (minimal): heading, one results grid (single store) or
 * one section per store (ChupaChoice), with empty and error states. Tabs,
 * sort, filters and pagination come later. Server Component.
 */
export function SearchPage({ view, retryUrl }: SearchPageProps) {
  const { query, results } = view;
  return (
    <div data-search-store={view.store} className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="text-2xl font-semibold">
        {query ? `Resultados para «${query}»` : 'Búsqueda'}
      </h1>
      {results.kind === 'none' && results.reason === 'empty_query' ? (
        <p className="py-12 text-center text-neutral-grey">Escribe lo que quieres buscar.</p>
      ) : null}
      {results.kind === 'single' ? (
        <div className="mt-6">
          <ListingBody listing={results.listing} query={query} retryUrl={retryUrl} />
        </div>
      ) : null}
      {results.kind === 'multi'
        ? results.listings.map((listing) => (
            <section
              key={listing.store}
              data-search-section={listing.store}
              aria-labelledby={`search-${listing.store}`}
              className="mt-8"
            >
              <h2 id={`search-${listing.store}`} className="text-xl font-semibold">
                {storeLabel(listing.store)}
              </h2>
              <div className="mt-4">
                <ListingBody listing={listing} query={query} retryUrl={retryUrl} />
              </div>
            </section>
          ))
        : null}
    </div>
  );
}

function ListingBody({
  listing,
  query,
  retryUrl,
}: {
  readonly listing: StoreListing;
  readonly query: string;
  readonly retryUrl: string;
}) {
  if (listing.failure !== null || listing.result === null) {
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
  if (listing.result.items.length === 0) {
    return (
      <p data-search-state="empty" className="py-12 text-center text-neutral-grey">
        No encontramos resultados para «{query}».
      </p>
    );
  }
  return <ProductCards cards={listing.result.items} appearance="grid" />;
}

function storeLabel(store: string): string {
  return SEARCH_STORES.find((entry) => entry.id === store)?.label ?? store;
}
