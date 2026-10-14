import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { after } from 'next/server';
import { Suspense } from 'react';
import { purchasableFromMagento } from '@/modules/cart/domain/add-to-cart';
import { AddToCart } from '@/modules/cart/ui/add-to-cart.client';
import {
  getCmsCanonicalUrl,
  getCmsPageView,
} from '@/modules/cms/infrastructure/cms-page.composition';
import { CmsPage } from '@/modules/cms/ui/cms-page';
import { buildCmsPageMetadata } from '@/modules/cms/ui/cms-page-metadata';
import {
  getCopyTrigger,
  resolveProductPage,
} from '@/modules/product/infrastructure/product-page.composition';
import { MagentoProductView } from '@/modules/product/ui/magento-product-view';
import { buildProductPageMetadata } from '@/modules/product/ui/product-page-metadata';
import { ProductSkeleton } from '@/modules/product/ui/product-skeleton';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
} from '@/modules/product/ui/product-structured-data';
import { ScrapedProductSection } from '@/modules/product/ui/scraped-product-section';
import { toPathname, toSearch } from '@/modules/routing/domain/request-path';
import { getSiteConfig } from '@/modules/seo/infrastructure/site-config';
import { JsonLd } from '@/modules/seo/ui/json-ld';

// Rendered per request; no data cache. There is deliberately no loading.tsx:
// it would commit a 200 before the Magento lookup decides 404/redirect.
export const dynamic = 'force-dynamic';

interface CatchAllProps {
  /** Undefined for `/` (optional catch-all). */
  readonly params: Promise<{ path?: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Same arguments in metadata and page, so `cache()` runs one Magento lookup. */
async function decide({ params, searchParams }: CatchAllProps) {
  const [{ path }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const pathname = toPathname(path);
  const search = toSearch(query);
  const decision = await resolveProductPage(pathname, search, requestHeaders.get('user-agent'));
  return { pathname, search, decision };
}

export async function generateMetadata(props: CatchAllProps): Promise<Metadata> {
  const { pathname, search, decision } = await decide(props);
  if (decision.kind === 'cms') {
    // Same cached decision as the page; a Magento failure rejects (5xx, never 404).
    // Magento keeps the metadata even when a Next component renders the page.
    const view = await getCmsPageView(pathname, search, decision.identifier);
    return view.kind === 'page'
      ? buildCmsPageMetadata(view.page, getCmsCanonicalUrl(view.canonicalPath))
      : {};
  }
  return buildProductPageMetadata(decision);
}

export default async function CatchAllPage(props: CatchAllProps) {
  // Decided before anything streams, so 404, redirects and 5xx keep their status.
  const { pathname, search, decision } = await decide(props);

  switch (decision.kind) {
    case 'redirect':
      return decision.permanent
        ? permanentRedirect(decision.location)
        : redirect(decision.location);
    case 'not_found':
      return notFound();
    case 'cms': {
      // Decided before anything streams: the configured home page's own url
      // answers a permanent redirect to `/` (query string kept) and a missing
      // page is a real 404, whether or not a Next component overrides it.
      const view = await getCmsPageView(pathname, search, decision.identifier);
      if (view.kind === 'redirect_home') return permanentRedirect(view.location);
      if (view.kind === 'not_found') return notFound();
      // A registered Next page replaces the Magento content; otherwise Magento renders.
      const Override = view.override;
      return Override ? <Override page={view.page} /> : <CmsPage page={view.page} />;
    }
    case 'magento_product': {
      const { copyRequest, product, canonicalUrl } = decision;
      if (copyRequest) after(() => getCopyTrigger().trigger(copyRequest));
      // Structured data only for products stored in Magento (indexable pages).
      const structuredData = (
        <>
          <JsonLd data={buildProductJsonLd(product, canonicalUrl)} />
          <JsonLd
            data={buildBreadcrumbJsonLd(product, {
              baseUrl: getSiteConfig().baseUrl,
              canonicalUrl,
            })}
          />
        </>
      );
      return (
        <MagentoProductView
          product={product}
          structuredData={structuredData}
          addToCart={<AddToCart product={purchasableFromMagento(product)} />}
        />
      );
    }
    case 'missing_product':
      return (
        <Suspense fallback={<ProductSkeleton />}>
          <ScrapedProductSection lookup={decision.lookup} searchUrl={decision.searchUrl} />
        </Suspense>
      );
  }
}
