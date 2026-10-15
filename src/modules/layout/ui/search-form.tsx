import Image from 'next/image';
import { DEFAULT_SEARCH_STORE, SEARCH_PATH, SEARCH_STORES } from '@/modules/layout/domain/search';
import { SearchIcon } from './icons';
import styles from './search-form.module.css';

/**
 * Legacy search bar as a plain GET form to the PWA Studio search page:
 * `/search.html?store=…&query=…&page=1` (same parameters as the legacy
 * search bar; their order does not matter). Works without JavaScript and
 * is a full navigation, like every link to pages PWA Studio still serves.
 *
 * Not replicated (needs client code, PWA Studio still provides it on its own
 * pages): autocomplete, remembering the last store, and the direct jump to
 * `/{store}-{sku}-search.html` when the query looks like a SKU.
 */
export function SearchForm() {
  return (
    <form action={SEARCH_PATH} method="get" role="search" className={styles.form}>
      <fieldset className={styles.tabs}>
        <legend className="sr-only">Tienda donde buscar</legend>
        {SEARCH_STORES.map((store) => (
          <label key={store.id} className={styles.tab}>
            <input
              type="radio"
              name="store"
              value={store.id}
              defaultChecked={store.id === DEFAULT_SEARCH_STORE}
              className={styles.radio}
            />
            <Image
              src={store.logo.src}
              alt={store.label}
              width={store.logo.width}
              height={store.logo.height}
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
          className={styles.input}
        />
        <input type="hidden" name="page" value="1" />
        <button type="submit" aria-label="Buscar" className={styles.submit}>
          <SearchIcon className="size-6" />
        </button>
      </div>
    </form>
  );
}
