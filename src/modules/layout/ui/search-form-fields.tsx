import { Icon } from '@/shared/ui/icon';
import type { SearchBarState } from '@/modules/layout/domain/search';
import styles from './search-form.module.css';

/**
 * Id of the header search form. The store pills live in the header top row,
 * outside the form, and join it through their `form` attribute, so the GET
 * submission stays `store`, `query` and `page` without JavaScript.
 */
export const SEARCH_FORM_ID = 'site-search';

/**
 * Query field and submit button of the search bar (DS pill with the leading
 * magnifier as the submit control), starting on the given query
 * (uncontrolled: the shopper changes it freely).
 */
export function SearchFormFields({ query }: Pick<SearchBarState, 'query'>) {
  return (
    <div className={styles.field}>
      <button type="submit" aria-label="Buscar" className={styles.submit}>
        <Icon name="search" size={16} strokeWidth={2} />
      </button>
      <label htmlFor="site-search-query" className="sr-only">
        Buscar productos
      </label>
      <input
        id="site-search-query"
        type="search"
        name="query"
        required
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Ingresa ASIN, SKU o Nombre del producto"
        defaultValue={query}
        className={styles.input}
      />
      <input type="hidden" name="page" value="1" />
    </div>
  );
}
