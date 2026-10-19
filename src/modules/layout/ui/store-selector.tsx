import Image from 'next/image';
import { SEARCH_STORES, type SearchBarState } from '@/modules/layout/domain/search';
import { SEARCH_FORM_ID } from './search-form-fields';
import styles from './search-form.module.css';

/**
 * Logo boxes as the PWA renders them (`storeSelector.module.css`: at most 72x18,
 * measured on the redesign): ChupaChoice 72, Amazon 60, eBay 45, Target 72 and
 * Acme 50 wide; heights follow each Next logo's own aspect ratio. Acme stays 50
 * wide because the PWA's Acme SVG declares a 842x303 box for its 148x15 artwork.
 * Fixed sizes, so the pills keep the PWA widths at every viewport.
 */
const LOGO_BOX: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  chupachoice: { width: 72, height: 9 },
  amazon: { width: 60, height: 18 },
  ebay: { width: 45, height: 18 },
  target: { width: 72, height: 16 },
  acme: { width: 50, height: 5 },
};

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
            width={LOGO_BOX[entry.id]?.width ?? entry.logo.width}
            height={LOGO_BOX[entry.id]?.height ?? entry.logo.height}
            loading="eager"
          />
        </label>
      ))}
    </div>
  );
}
