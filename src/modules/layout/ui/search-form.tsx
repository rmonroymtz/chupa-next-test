import { SEARCH_PATH } from '@/modules/layout/domain/search';
import { CurrentSearchFormFields } from './current-search-form-fields.client';
import styles from './search-form.module.css';

/**
 * Legacy search bar as a plain GET form to the search page:
 * `/search.html?store=…&query=…&page=1` (same parameters as the legacy
 * search bar; their order does not matter). Works without JavaScript and
 * is a full navigation.
 *
 * On `/search.html` it starts on the searched store and query; elsewhere on
 * the default tab with an empty field. No Suspense boundary around the
 * fields on purpose: React would outline it (it holds images), sending the
 * default state first and the real one later, which needs JavaScript.
 *
 * Not replicated: autocomplete, remembering the last store, and the direct
 * jump to `/{store}-{sku}-search.html` when the query looks like a SKU.
 */
export function SearchForm() {
  return (
    <form action={SEARCH_PATH} method="get" role="search" className={styles.form}>
      <CurrentSearchFormFields />
    </form>
  );
}
