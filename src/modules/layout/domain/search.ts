/** Legacy PWA Studio search page (`/search.html`), still served by PWA Studio. */
export const SEARCH_PATH = '/search.html';

export interface SearchStore {
  /** Value of the `store` query parameter. */
  readonly id: string;
  /** Shopper-facing store name (logo alt text). */
  readonly label: string;
  /** Logo under `public/`, with its intrinsic aspect ratio. */
  readonly logo: { readonly src: string; readonly width: number; readonly height: number };
}

/**
 * Store tabs of the legacy search bar (`STORE_CONFIGS`, ordered by `position`).
 * ChupaChoice resolves the store from the query itself.
 */
export const SEARCH_STORES: readonly SearchStore[] = [
  {
    id: 'chupachoice',
    label: 'ChupaChoice',
    logo: { src: '/images/layout/stores/chupachoice.svg', width: 101, height: 12 },
  },
  {
    id: 'amazon',
    label: 'Amazon',
    logo: { src: '/images/layout/stores/amazon.svg', width: 93, height: 28 },
  },
  {
    id: 'ebay',
    label: 'eBay',
    logo: { src: '/images/layout/stores/ebay.svg', width: 76, height: 30 },
  },
  {
    id: 'target',
    label: 'Target',
    logo: { src: '/images/layout/stores/target.svg', width: 148, height: 32 },
  },
  {
    id: 'acme',
    label: 'Acme',
    logo: { src: '/images/layout/stores/acme.svg', width: 148, height: 15 },
  },
];

/**
 * Legacy default when the shopper never picked a store. The legacy bar also
 * remembers the last pick in browser storage (`currentStoreSearcher`); the
 * server-rendered form cannot read it, so it always starts on the default.
 */
export const DEFAULT_SEARCH_STORE = 'chupachoice';
