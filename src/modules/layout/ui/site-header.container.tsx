import 'server-only';
import { Suspense } from 'react';
import { getCategoryMenu } from '@/modules/layout/infrastructure/category-menu.composition';
import {
  DesktopCategoryNav,
  DesktopCategoryNavPlaceholder,
  MobileCategoryMenu,
  MobileCategoryMenuPlaceholder,
} from './category-nav';
import { SiteHeader } from './site-header';

async function DesktopCategoryNavContainer() {
  return <DesktopCategoryNav items={await getCategoryMenu()} />;
}

async function MobileCategoryMenuContainer() {
  return <MobileCategoryMenu items={await getCategoryMenu()} />;
}

/**
 * Header with the Magento category menu fetched per request. The menu streams
 * inside its own Suspense boundaries (same-size placeholders), so a slow menu
 * query never delays the page shell or its status, and a failed one renders
 * the header without categories.
 */
export function SiteHeaderContainer() {
  return (
    <SiteHeader
      mobileNavigation={
        <Suspense fallback={<MobileCategoryMenuPlaceholder />}>
          <MobileCategoryMenuContainer />
        </Suspense>
      }
      desktopNavigation={
        <Suspense fallback={<DesktopCategoryNavPlaceholder />}>
          <DesktopCategoryNavContainer />
        </Suspense>
      }
    />
  );
}
