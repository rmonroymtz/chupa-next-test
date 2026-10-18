import Image from 'next/image';
import type { ReactNode } from 'react';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';
import { Icon } from '@/shared/ui/icon';
import { CartTriggerSlot } from './cart-trigger-slot';
import { SearchForm } from './search-form';
import { CurrentStoreSelector } from './store-selector.client';

interface SiteHeaderProps {
  /** Menu button + navigation drawer (left of the logo, below 1024). */
  readonly mobileNavigation: ReactNode;
  /** "Categorías" dropdown (right of the logo, from 1024). */
  readonly desktopNavigation: ReactNode;
}

/**
 * DS header (FIGMA-MAKE-HEADER-AUDIT §4-5, colors and type mapped to the DS
 * tokens). Row 1: menu button (below 1024), logo, "Categorías" (from 1024),
 * store pills and the "Mi cuenta" / cart actions; below 1024 the pills wrap to
 * their own line under the logo row. Row 2: the full-width search pill. One
 * search form, never duplicated; the pills join it through its id. No
 * horizontal category bar: like the PWA, categories open from "Categorías".
 *
 * Links go to pages PWA Studio still serves: plain anchors (see
 * `legacy-routes.ts`).
 *
 * The logo is eager (above the fold) but not `priority`/`preload`: on product
 * and CMS pages the LCP element is the product image or the hero banner, and a
 * high-priority logo would compete with it. Width and height attributes keep
 * its box reserved before it loads. It is sized by width (102/125/136): the DS
 * wordmark is a wide lockup, so the audit's 24px height would make it ~2x wider.
 */
export function SiteHeader({ mobileNavigation, desktopNavigation }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ds-border bg-ds-surface text-ds-text">
      <div className="container-padded flex flex-col gap-3 py-3 lg:gap-4 lg:py-5">
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-5">
          {mobileNavigation}
          <a
            href={LEGACY_ROUTES.home}
            className="flex min-w-0 flex-1 justify-center rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus lg:flex-none lg:justify-start"
          >
            <Image
              src="/images/layout/logo.svg"
              alt="Chupaprecios"
              width={394}
              height={37}
              loading="eager"
              className="h-auto w-[102px] md:w-[125px] lg:w-[136px]"
            />
          </a>
          {desktopNavigation}
          <div className="order-last basis-full lg:order-none lg:ml-auto lg:basis-auto">
            <CurrentStoreSelector />
          </div>
          <div className="flex items-center gap-3.5 lg:ml-auto lg:gap-5">
            <a
              href={LEGACY_ROUTES.signIn}
              className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-xs text-body-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus lg:min-w-0"
            >
              <Icon name="user" size={16} className="text-ds-neutral-950 lg:size-3.5" />
              <span className="sr-only lg:not-sr-only">Mi cuenta</span>
            </a>
            <CartTriggerSlot />
          </div>
        </div>
        <SearchForm />
      </div>
    </header>
  );
}
