import Image from 'next/image';
import { SEARCH_STORES } from '@/modules/layout/domain/search';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type { StoreListing } from '@/modules/search/application/search-page';
import { storeTabHref } from '@/modules/search/domain/search-links';
import type { SearchItem } from '@/modules/search/domain/search-result';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';

/*
 * ChupaChoice store list, replicating the legacy PWA `ProductList`
 * (`@chupaprecios/chupachoice/src/components/ProductList`): logo header with
 * "Ver MÁS productos", a 2 / 3 / 6 column grid of bordered items, and the
 * legacy no-results box. Only the ChupaChoice view uses it; the single-store
 * view keeps the CMS product grid.
 */

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
// Legacy grid: 2 columns on phones, 3 from 768px, 6 from 1280px.
const ITEM_IMAGE_SIZES = '(min-width: 1280px) 17vw, (min-width: 768px) 33vw, 50vw';
const MAX_NAME_LENGTH = 90;
const PRICE_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface SectionLogo {
  readonly src: string;
  /** Rendered size: the legacy icon component's size with `max-height: 48px`. */
  readonly width: number;
  readonly height: number;
}

/**
 * Same SVGs as the header search bar for Amazon, eBay and Target. Acme differs:
 * the legacy list uses the square `AcmeLogo`, the search bar the `AcmeTypeLogo` wordmark.
 */
const SECTION_LOGOS: Readonly<Record<string, SectionLogo>> = {
  amazon: { src: '/images/layout/stores/amazon.svg', width: 80, height: 24 },
  ebay: { src: '/images/layout/stores/ebay.svg', width: 60, height: 24 },
  target: { src: '/images/layout/stores/target.svg', width: 148, height: 32 },
  acme: { src: '/images/search/stores/acme.svg', width: 131, height: 48 },
};

export function ChupaChoiceSection({
  listing,
  query,
  retryUrl,
}: {
  readonly listing: StoreListing;
  readonly query: string;
  readonly retryUrl: string;
}) {
  const { result, store } = listing;
  const failed = listing.failure !== null || result === null;
  const items = result?.items ?? [];
  const label = storeLabel(store);
  return (
    <section data-search-section={store} aria-labelledby={`search-${store}`} className="mb-12">
      <div className="mb-2 flex items-center justify-start gap-5">
        <h2 id={`search-${store}`} className="flex">
          <StoreLogo store={store} label={label} />
        </h2>
        {!failed && items.length > 0 ? (
          <a
            href={storeTabHref(query, store)}
            aria-label={`Ver más productos de ${label}`}
            className="inline-flex items-center justify-center gap-1 text-center text-[20px] leading-[50px] font-light text-brand-yellow uppercase"
          >
            Ver <span className="text-[42px] font-bold">MÁS</span> productos
            <Chevron />
          </a>
        ) : null}
      </div>
      {failed ? (
        <NoResults
          state="error"
          title="No pudimos consultar esta tienda en este momento"
          query={query}
          retryUrl={retryUrl}
        />
      ) : items.length === 0 ? (
        <NoResults state="empty" title="Esta tienda no tiene ninguna coincidencia" query={query} />
      ) : (
        <ul
          data-search-grid="chupachoice"
          className="mt-4 grid list-none grid-cols-2 gap-x-[10px] gap-y-4 p-0 md:grid-cols-3 md:gap-x-[22px] md:gap-y-[30px] xl:grid-cols-6"
        >
          {items.map((item) => (
            <ChupaChoiceItem key={item.uid} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function StoreLogo({ store, label }: { readonly store: string; readonly label: string }) {
  const logo = SECTION_LOGOS[store];
  if (!logo) return <span className="text-xl font-semibold">{label}</span>;
  return (
    <Image
      src={logo.src}
      alt={label}
      width={logo.width}
      height={logo.height}
      className="max-w-[150px]"
    />
  );
}

function ChupaChoiceItem({ item }: { readonly item: SearchItem }) {
  const price = getDisplayPrice(item);
  const discount =
    price?.previous != null
      ? Math.round(((price.previous - price.amount) / price.previous) * 100)
      : 0;
  const name =
    item.name.length > MAX_NAME_LENGTH
      ? `${item.name.substring(0, MAX_NAME_LENGTH - 3)}...`
      : item.name;
  return (
    <li className="flex w-full min-w-0 flex-col rounded-[10px] border border-[#e0e0e0] p-[10px] transition-shadow duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:p-[15px]">
      {/* Plain anchor: next/link would prefetch product pages (and their side effects). */}
      <a href={`/${item.relativeUrl}`} className="flex flex-1 flex-col text-inherit no-underline">
        <div className="relative mb-[10px] flex aspect-[194/172] w-full items-center justify-center overflow-hidden rounded-[10px]">
          {item.image ? (
            <Image
              src={item.image.url}
              alt={item.name}
              fill
              sizes={ITEM_IMAGE_SIZES}
              style={{ objectFit: 'contain' }}
              unoptimized={!isOptimizableImageUrl(item.image.url, REMOTE_PATTERNS)}
            />
          ) : null}
        </div>
        {item.rating ? <Rating value={item.rating} /> : null}
        <div className="flex min-h-0 flex-1 flex-col">
          <h3 className="mb-auto text-left text-[12px] leading-none font-normal">{name}</h3>
          {price ? (
            <div className="mt-4 flex items-end justify-between gap-2 max-[359px]:justify-start max-[359px]:gap-1.5">
              {discount > 0 ? (
                <>
                  <div data-search-discount className="flex flex-col items-start gap-0.5">
                    <p className="m-0 text-[10px] leading-none font-normal text-brand-red uppercase">
                      Promoción
                    </p>
                    <p className="m-0 text-[20px] leading-[34px] font-bold text-brand-red max-[359px]:text-[14px] max-[359px]:leading-5">
                      {discount}%
                    </p>
                  </div>
                  <div className="w-px self-stretch bg-neutral-inactive" />
                </>
              ) : null}
              <div data-search-price className="flex flex-col items-end gap-0.5">
                <p className="m-0 text-[10px] leading-none font-normal text-neutral-black-base uppercase">
                  Precio final
                </p>
                <p className="m-0 text-[20px] leading-[34px] font-bold max-[359px]:text-[14px] max-[359px]:leading-5">
                  ${PRICE_FORMAT.format(price.amount)}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </a>
    </li>
  );
}

/** Legacy `StarActive` / `StarInactive`: a star is active up to the rating. */
function Rating({ value }: { readonly value: number }) {
  return (
    <div
      data-search-rating
      role="img"
      aria-label={`${value} de 5 estrellas`}
      className="mb-2 flex flex-row items-center justify-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((star) =>
        star <= value ? <StarActive key={star} /> : <StarInactive key={star} />,
      )}
    </div>
  );
}

function NoResults({
  state,
  title,
  query,
  retryUrl,
}: {
  readonly state: 'empty' | 'error';
  readonly title: string;
  readonly query: string;
  readonly retryUrl?: string;
}) {
  return (
    <div
      data-search-state={state}
      role={state === 'error' ? 'alert' : undefined}
      className="mt-8 box-border flex w-full flex-col items-center gap-3 rounded-[10px] bg-[rgba(255,229,191,0.25)] px-5 py-10 md:py-[75px]"
    >
      <p className="mb-8 text-center text-[40px] leading-[40px] font-normal md:text-[80px] md:leading-none">
        {title}
      </p>
      <p className="m-0 text-center text-[18px] leading-none font-normal">
        Búsqueda: <span className="font-bold">{query}</span>
      </p>
      {retryUrl ? (
        // Not in the legacy PWA: a full request runs this store's search again on the server.
        <a href={retryUrl} className="text-sm font-semibold underline">
          Reintentar
        </a>
      ) : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="7" height="15" viewBox="0 0 7 15" fill="none" aria-hidden="true">
      <path
        d="M0.499999 0.681641C0.500008 0.647906 0.505715 0.61585 0.515624 0.587891C0.525542 0.559912 0.538602 0.538645 0.550781 0.524414C0.562763 0.510469 0.573071 0.504399 0.578124 0.501953C0.580638 0.500746 0.582201 0.500164 0.583007 0.5C0.583005 0.499977 0.584956 0.50006 0.588867 0.501953C0.593934 0.504408 0.60421 0.510428 0.61621 0.524414L6.44922 7.34082C6.46119 7.35475 6.47452 7.37569 6.48437 7.40332C6.49424 7.43111 6.50002 7.46346 6.5 7.49707L6.5 7.50195C6.50002 7.53557 6.49424 7.56791 6.48437 7.5957C6.47451 7.62337 6.4612 7.64426 6.44922 7.6582L6.44922 7.65918L0.616211 14.4756C0.60413 14.4897 0.593858 14.4956 0.588867 14.498C0.586309 14.4993 0.584624 14.4999 0.583984 14.5L0.583008 14.5L0.578125 14.498C0.573149 14.4956 0.562845 14.4896 0.550781 14.4756C0.524914 14.4454 0.500018 14.3895 0.5 14.3184C0.5 14.2472 0.524904 14.1914 0.550781 14.1611L5.97168 7.82715L6.25 7.50195L5.97168 7.17676L0.550781 0.838867C0.538602 0.824637 0.525542 0.803369 0.515624 0.775391C0.505739 0.747447 0.499999 0.715351 0.499999 0.681641Z"
        fill="#FDAA40"
        stroke="#FDAA40"
      />
    </svg>
  );
}

function StarActive() {
  return (
    <svg
      data-star="active"
      width="13"
      height="14"
      viewBox="0 0 13 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.14054 0.251901C6.17345 0.176313 6.22446 0.112647 6.28779 0.0681236C6.35112 0.0236001 6.42423 0 6.49883 0C6.57343 0 6.64654 0.0236001 6.70987 0.0681236C6.7732 0.112647 6.82421 0.176313 6.85712 0.251901L8.41658 3.81527C8.4887 3.98038 8.5953 4.12323 8.7272 4.2315C8.8591 4.33976 9.01233 4.4102 9.1737 4.43674L12.6575 5.00804C12.7314 5.02002 12.8008 5.05511 12.8579 5.10935C12.9149 5.16358 12.9574 5.23478 12.9805 5.31488C13.0035 5.39498 13.0062 5.48077 12.9883 5.56252C12.9704 5.64427 12.9325 5.71871 12.879 5.77741L10.3581 8.55116C10.2413 8.67969 10.1539 8.83836 10.1036 9.01349C10.0532 9.18862 10.0412 9.37496 10.0688 9.55644L10.6638 13.4728C10.6764 13.5557 10.6683 13.641 10.6402 13.7189C10.6122 13.7969 10.5653 13.8644 10.505 13.9139C10.4448 13.9633 10.3734 13.9928 10.2991 13.9988C10.2247 14.0049 10.1504 13.9873 10.0844 13.9481L6.9655 12.0996C6.82121 12.014 6.66066 11.9693 6.49766 11.9693C6.33467 11.9693 6.17411 12.014 6.02982 12.0996L2.91089 13.9481C2.84513 13.985 2.77163 14.0007 2.69848 13.9934C2.62533 13.9862 2.55537 13.9563 2.4963 13.9071C2.43722 13.8579 2.39131 13.7912 2.36362 13.7144C2.33593 13.6376 2.32753 13.5537 2.33935 13.4719L2.93429 9.55556C2.96188 9.37407 2.94996 9.18774 2.89957 9.01261C2.84917 8.83748 2.76181 8.67881 2.64501 8.55028L0.121014 5.77741C0.0675105 5.71871 0.0296442 5.64427 0.011709 5.56252C-0.00622618 5.48077 -0.00351263 5.39498 0.0195419 5.31488C0.0425965 5.23478 0.0850697 5.16358 0.142145 5.10935C0.19922 5.05511 0.268614 5.02002 0.342458 5.00804L3.82552 4.43674C3.98689 4.4102 4.14012 4.33976 4.27202 4.2315C4.40392 4.12323 4.51052 3.98038 4.58264 3.81527L6.14054 0.251901Z"
        fill="#FDAA40"
      />
    </svg>
  );
}

function StarInactive() {
  return (
    <svg
      data-star="inactive"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.61289 0.251901C6.64833 0.176313 6.70327 0.112647 6.77146 0.0681236C6.83966 0.0236001 6.9184 0 6.99874 0C7.07908 0 7.15782 0.0236001 7.22602 0.0681236C7.29422 0.112647 7.34915 0.176313 7.38459 0.251901L9.06401 3.81527C9.14168 3.98038 9.25648 4.12323 9.39852 4.2315C9.54056 4.33976 9.70559 4.4102 9.87937 4.43674L13.6312 5.00804C13.7107 5.02002 13.7855 5.05511 13.8469 5.10935C13.9084 5.16358 13.9541 5.23478 13.979 5.31488C14.0038 5.39498 14.0067 5.48077 13.9874 5.56252C13.9681 5.64427 13.9273 5.71871 13.8697 5.77741L11.1549 8.55116C11.0291 8.67969 10.935 8.83836 10.8807 9.01349C10.8265 9.18862 10.8136 9.37496 10.8434 9.55644L11.4841 13.4728C11.4977 13.5557 11.4889 13.641 11.4587 13.7189C11.4285 13.7969 11.3781 13.8644 11.3131 13.9139C11.2482 13.9633 11.1714 13.9928 11.0913 13.9988C11.0113 14.0049 10.9312 13.9873 10.8602 13.9481L7.50131 12.0996C7.34592 12.014 7.17301 11.9693 6.99748 11.9693C6.82195 11.9693 6.64904 12.014 6.49365 12.0996L3.13481 13.9481C3.06398 13.985 2.98483 14.0007 2.90606 13.9934C2.82728 13.9862 2.75194 13.9563 2.68832 13.9071C2.6247 13.8579 2.57526 13.7912 2.54544 13.7144C2.51562 13.6376 2.50657 13.5537 2.5193 13.4719L3.16 9.55556C3.18972 9.37407 3.17688 9.18774 3.12261 9.01261C3.06834 8.83748 2.97425 8.67881 2.84847 8.55028L0.130323 5.77741C0.0727036 5.71871 0.0319245 5.64427 0.0126097 5.56252C-0.00670512 5.48077 -0.00378283 5.39498 0.0210452 5.31488C0.0458732 5.23478 0.0916135 5.16358 0.153079 5.10935C0.214545 5.05511 0.289277 5.02002 0.368801 5.00804L4.11979 4.43674C4.29357 4.4102 4.4586 4.33976 4.60064 4.2315C4.74268 4.12323 4.85748 3.98038 4.93515 3.81527L6.61289 0.251901Z"
        fill="#AAAAAA"
      />
    </svg>
  );
}

function storeLabel(store: string): string {
  return SEARCH_STORES.find((entry) => entry.id === store)?.label ?? store;
}
