import Image from 'next/image';
import { SEARCH_STORES, type SearchBarState } from '@/modules/layout/domain/search';
import { SEARCH_FORM_ID } from './search-form-fields';
import styles from './search-form.module.css';

/**
 * DS store selector: one pill per search store, in the header top row. Native
 * radios (arrow keys move the choice, one tab stop) submitted with the search
 * form through `form`; the checked pill carries the brand border. Pure CSS
 * (`:has(:checked)`), no JS. Uncontrolled: starts on the given store.
 */
export function StoreSelector({ store }: Pick<SearchBarState, 'store'>) {
  return (
    <div role="radiogroup" aria-label="Tienda donde buscar" className={styles.stores}>
      {SEARCH_STORES.map((entry) => (
        <label key={entry.id} className={styles.store}>
          <input
            type="radio"
            form={SEARCH_FORM_ID}
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
    </div>
  );
}
