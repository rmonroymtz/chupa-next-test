'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { currentSearch } from '@/modules/layout/domain/search';
import { StoreSelector } from './store-selector';

/**
 * Store pills starting on the store being searched on `/search.html` (the
 * default store elsewhere). Rendered on the server from the url like the
 * search fields, and like them without a Suspense boundary: React would
 * outline it (it holds images) and send the default store first.
 */
export function CurrentStoreSelector() {
  return <StoreSelector store={currentSearch(usePathname(), useSearchParams()).store} />;
}
