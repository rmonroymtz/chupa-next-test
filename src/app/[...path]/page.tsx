import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { after } from 'next/server';
import { Suspense } from 'react';
import { purchasableFromMagento } from '@/modules/cart/domain/add-to-cart';
import { AddToCart } from '@/modules/cart/ui/add-to-cart.client';
import { getCmsCanonicalUrl, getCmsPage } from '@/modules/cms/infrastructure/cms-page.composition';
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
import { getSiteConfig } from '@/modules/seo/infrastructure/site-config';
import { JsonLd } from '@/modules/seo/ui/json-ld';

// Rendered per request; no data cache. There is deliberately no loading.tsx:
// it would commit a 200 before the Magento lookup decides 404/redirect.
export const dynamic = 'force-dynamic';

interface CatchAllProps {
  readonly params: Promise<{ path: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Same arguments in metadata and page, so `cache()` runs one Magento lookup. */
async function decide({ params, searchParams }: CatchAllProps) {
  const [{ path }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  return resolveProductPage(toPathname(path), toSearch(query), requestHeaders.get('user-agent'));
}

export async function generateMetadata(props: CatchAllProps): Promise<Metadata> {
  const decision = await decide(props);
  if (decision.kind === 'cms') {
    // Same cached lookup as the page; a Magento failure rejects (5xx, never 404).
    const page = await getCmsPage(decision.identifier);
    return page ? buildCmsPageMetadata(page, getCmsCanonicalUrl(page)) : {};
  }
  return buildProductPageMetadata(decision);
}

export default async function CatchAllPage(props: CatchAllProps) {
  // Decided before anything streams, so 404, redirects and 5xx keep their status.
  const decision = await decide(props);

  switch (decision.kind) {
    case 'redirect':
      return decision.permanent
        ? permanentRedirect(decision.location)
        : redirect(decision.location);
    case 'not_found':
      return notFound();
    case 'cms': {
      // Read before anything streams, so a missing page is a real 404.
      const page = await getCmsPage(decision.identifier);
      if (!page) return notFound();
      return <CmsPage page={page} />;
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

/**
 * Next 16.4 passes catch-all segments percent-decoded to `generateMetadata`
 * but still encoded to the page (observed: `|` vs `%7C`). Normalizing each
 * segment to one encoded form gives both the same `cache()` key, and
 * `toRouteUrl` then decodes the path exactly once.
 */
function toPathname(segments: readonly string[]): string {
  return `/${segments.map((segment) => encodeURIComponent(safeDecode(segment))).join('/')}`;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // Already decoded and holds a literal `%`.
  }
}

function toSearch(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, entry);
    }
  }
  return params.toString();
}
