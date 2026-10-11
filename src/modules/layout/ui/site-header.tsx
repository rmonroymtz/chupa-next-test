import Image from 'next/image';
import type { ReactNode } from 'react';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';
import { CartTriggerSlot } from './cart-trigger-slot';
import { UserIcon } from './icons';
import { SearchForm } from './search-form';

interface SiteHeaderProps {
  /** Mobile menu button (left of the logo, hidden from `lg`). */
  readonly mobileNavigation: ReactNode;
  /** Desktop category bar (below the toolbar, from `lg`). */
  readonly desktopNavigation: ReactNode;
}

/**
 * Legacy PWA Studio header: logo, search with store tabs, sign-in and cart,
 * then the category bar. One search form placed by the grid (below the
 * toolbar on mobile, centered on desktop), so it is never duplicated.
 *
 * Links go to pages PWA Studio still serves: plain anchors (see
 * `legacy-routes.ts`).
 *
 * The logo is eager (above the fold) but not `priority`/`preload`: on product
 * and CMS pages the LCP element is the product image or the hero banner, and a
 * high-priority logo would compete with it. Width and height attributes keep
 * its box reserved before it loads.
 */
export function SiteHeader({ mobileNavigation, desktopNavigation }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white shadow-header">
      <div className="container-padded grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 pt-5 pb-4 lg:grid-cols-12">
        <div className="flex min-w-0 items-center gap-2 lg:col-span-3">
          {mobileNavigation}
          <a href={LEGACY_ROUTES.home} className="flex min-w-0 items-center">
            <Image
              src="/images/layout/logo.svg"
              alt="Chupaprecios"
              width={398}
              height={37}
              loading="eager"
              className="h-auto w-[230px] max-w-full sm:w-[300px] xl:w-[360px]"
            />
          </a>
        </div>
        <div className="col-span-2 row-start-2 lg:col-span-6 lg:row-start-1 lg:px-8">
          <SearchForm />
        </div>
        <div className="flex items-center justify-end gap-3 lg:col-span-3">
          <a
            href={LEGACY_ROUTES.signIn}
            className="hidden h-12 min-w-36 items-center gap-2 rounded-full border border-neutral-medium-grey px-4 text-xs lg:flex"
          >
            <UserIcon className="size-[30px]" />
            Iniciar sesión
          </a>
          <CartTriggerSlot />
        </div>
      </div>
      {desktopNavigation}
    </header>
  );
}
