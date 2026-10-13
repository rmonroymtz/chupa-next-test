import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { after } from 'next/server';
import { Suspense } from 'react';
import { CmsPage } from '@/modules/cms/ui/cms-page';
import {
  getCopyTrigger,
  resolveProductPage,
} from '@/modules/product/infrastructure/product-page.composition';
import { MagentoProductView } from '@/modules/product/ui/magento-product-view';
import { buildProductPageMetadata } from '@/modules/product/ui/product-page-metadata';
import { ProductSkeleton } from '@/modules/product/ui/product-skeleton';
import { ScrapedProductSection } from '@/modules/product/ui/scraped-product-section';

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
  return buildProductPageMetadata(await decide(props));
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
    case 'cms':
      return <CmsPage identifier={decision.identifier} />;
    case 'magento_product': {
      const { copyRequest } = decision;
      if (copyRequest) after(() => getCopyTrigger().trigger(copyRequest));
      return (
        <main>
          <MagentoProductView product={decision.product} />
        </main>
      );
    }
    case 'missing_product':
      return (
        <main>
          <Suspense fallback={<ProductSkeleton />}>
            <ScrapedProductSection lookup={decision.lookup} searchUrl={decision.searchUrl} />
          </Suspense>
        </main>
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
