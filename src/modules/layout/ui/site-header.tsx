import Image from 'next/image';
import type { ReactNode } from 'react';
import { AccountAction } from '@/modules/customer/ui/account-action.client';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';
import { CartTriggerSlot } from './cart-trigger-slot';
import { SearchForm } from './search-form';
import searchStyles from './search-form.module.css';
import { CurrentStoreSelector } from './store-selector.client';

interface SiteHeaderProps {
  /** Menu button + navigation drawer (left of the logo, below 1160). */
  readonly mobileNavigation: ReactNode;
  /** Category bar under the main row (from 1160), with the "Categorías" dropdown first. */
  readonly desktopNavigation: ReactNode;
}

/*
 * One grid, two layouts, so nothing renders twice (one search form, one store
 * selector joined to it by id):
 * - below 1160 (DS header, FIGMA-MAKE-HEADER-AUDIT §4-5): menu button, centered
 *   logo and the actions on the first row, the store pills on the second, the
 *   search pill on the third;
 * - from 1160 (Figma "Header" 3460:4925): the logo, the search block and the
 *   actions on one row, the store tabs sitting on top of the search input.
 */
const GRID_CLASS = [
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3',
  "[grid-template-areas:'nav_logo_actions'_'stores_stores_stores'_'search_search_search']",
  'desktop:grid-cols-[auto_minmax(0,790px)_auto] desktop:justify-between desktop:gap-x-10 desktop:gap-y-0 desktop:py-6',
  "desktop:[grid-template-areas:'._stores_.'_'logo_search_actions']",
].join(' ');

/**
 * Site header. Links go to pages PWA Studio still serves: plain anchors (see
 * `legacy-routes.ts`).
 *
 * The logo is eager (above the fold) but not `priority`/`preload`: on product
 * and CMS pages the LCP element is the product image or the hero banner, and a
 * high-priority logo would compete with it. Width and height attributes keep
 * its box reserved before it loads. It is sized by width (102/125/136, 177 from
 * 1160 as in the Figma header): the DS wordmark is a wide lockup.
 */
export function SiteHeader({ mobileNavigation, desktopNavigation }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ds-border bg-ds-surface text-ds-text">
      {/* `searchScope`: the chosen store's brand color for the tabs and the search field. */}
      <div className={`header-padded ${GRID_CLASS} ${searchStyles.searchScope}`}>
        <div className="[grid-area:nav] desktop:hidden">{mobileNavigation}</div>
        <a
          href={LEGACY_ROUTES.home}
          className="flex min-w-0 justify-center justify-self-center rounded-xs [grid-area:logo] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus desktop:justify-self-start"
        >
          <Image
            src="/images/layout/logo.svg"
            alt="Chupaprecios"
            width={394}
            height={37}
            loading="eager"
            className="h-auto w-[102px] md:w-[125px] desktop:w-[177px]"
          />
        </a>
        <div className="min-w-0 [grid-area:stores] desktop:self-end">
          <CurrentStoreSelector />
        </div>
        <div className="min-w-0 [grid-area:search]">
          <SearchForm />
        </div>
        {/* PWA `.actions`: 20px between the actions. Below 1160 the 40px boxes around the
            20px icons already put 20px between the icons. */}
        <div className="flex items-center [grid-area:actions] desktop:gap-5">
          <AccountAction signInHref={LEGACY_ROUTES.signIn} />
          <CartTriggerSlot />
        </div>
      </div>
      {desktopNavigation}
    </header>
  );
}
