import 'server-only';
import { Suspense } from 'react';
import { getCategoryMenu } from '@/modules/layout/infrastructure/category-menu.composition';
import { CategoriesDropdownPlaceholder } from './categories-dropdown';
import { CategoriesDropdown } from './categories-dropdown.client';
import { NavDrawerPlaceholder } from './nav-drawer';
import { NavDrawer } from './nav-drawer.client';
import { SiteHeader } from './site-header';

async function CategoriesDropdownContainer() {
  const items = await getCategoryMenu();
  return items.length > 0 ? (
    <CategoriesDropdown items={items} />
  ) : (
    <CategoriesDropdownPlaceholder />
  );
}

async function NavDrawerContainer() {
  return <NavDrawer items={await getCategoryMenu()} />;
}

/**
 * Header with the Magento category menu fetched per request. The menu streams
 * inside its own Suspense boundaries (same-size placeholders), so a slow menu
 * query never delays the page shell or its status, and a failed one renders
 * the header without categories (the drawer keeps the account entry).
 */
export function SiteHeaderContainer() {
  return (
    <SiteHeader
      mobileNavigation={
        <Suspense fallback={<NavDrawerPlaceholder />}>
          <NavDrawerContainer />
        </Suspense>
      }
      desktopNavigation={
        <Suspense fallback={<CategoriesDropdownPlaceholder />}>
          <CategoriesDropdownContainer />
        </Suspense>
      }
    />
  );
}
