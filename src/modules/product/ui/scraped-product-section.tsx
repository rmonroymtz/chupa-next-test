import { after } from 'next/server';
import type { VendorProductRef } from '@/modules/product/application/product-page-service';
import {
  getCopyTrigger,
  getScrapedProductLoader,
} from '@/modules/product/infrastructure/product-page.composition';
import { ProductUnavailable } from '@/modules/product/ui/product-unavailable';
import { ScrapedProductView } from '@/modules/product/ui/scraped-product-view';

interface ScrapedProductSectionProps {
  readonly lookup: VendorProductRef | null;
  readonly searchUrl: string;
}

/**
 * Streamed part of a `missing_user` page (rendered inside `<Suspense>`). The
 * loader never rejects, so this boundary always resolves to the product or
 * to the unavailable state. The copy mutation is scheduled only once the
 * scraper found the product, and runs after the response has finished.
 */
export async function ScrapedProductSection({ lookup, searchUrl }: ScrapedProductSectionProps) {
  const outcome = await getScrapedProductLoader().load(lookup);
  if (outcome.kind !== 'found') return <ProductUnavailable searchUrl={searchUrl} />;

  const { copyRequest } = outcome;
  after(() => getCopyTrigger().trigger(copyRequest));
  return <ScrapedProductView product={outcome.product} />;
}
