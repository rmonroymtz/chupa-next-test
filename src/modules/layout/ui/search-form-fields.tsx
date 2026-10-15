import Image from 'next/image';
import { SEARCH_STORES, type SearchBarState } from '@/modules/layout/domain/search';
import { SearchIcon } from './icons';
import styles from './search-form.module.css';

/**
 * Store tabs, query field and submit button of the search bar, starting on
 * the given store and query (uncontrolled: the shopper changes them freely).
 */
export function SearchFormFields({ store, query }: SearchBarState) {
  return (
    <>
      <fieldset className={styles.tabs}>
        <legend className="sr-only">Tienda donde buscar</legend>
        {SEARCH_STORES.map((entry) => (
          <label key={entry.id} className={styles.tab}>
            <input
              type="radio"
              name="store"
              value={entry.id}
              defaultChecked={entry.id === store}
              className={styles.radio}
            />
            <Image
              src={entry.logo.src}
              alt={entry.label}
              width={entry.logo.width}
              height={entry.logo.height}
              loading="eager"
            />
          </label>
        ))}
      </fieldset>
      <div className={styles.field}>
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
          placeholder="¿Qué productos vas a importar hoy?"
          defaultValue={query}
          className={styles.input}
        />
        <input type="hidden" name="page" value="1" />
        <button type="submit" aria-label="Buscar" className={styles.submit}>
          <SearchIcon className="size-6" />
        </button>
      </div>
    </>
  );
}
