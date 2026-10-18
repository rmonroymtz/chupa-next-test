'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { currentSearch } from '@/modules/layout/domain/search';
import { SearchFormFields } from './search-form-fields';

/**
 * Search bar fields starting on the search being shown (`/search.html`
 * query; the store pills read the store the same way). Every route renders
 * per request, so the url is read during the server render too: the markup
 * is right without JavaScript and hydrates without a change.
 */
export function CurrentSearchFormFields() {
  return <SearchFormFields query={currentSearch(usePathname(), useSearchParams()).query} />;
}
