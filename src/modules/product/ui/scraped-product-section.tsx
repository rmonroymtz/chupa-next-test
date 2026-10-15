import { after } from 'next/server';
import { purchasableFromScraped } from '@/modules/cart/domain/add-to-cart';
import { AddToCart } from '@/modules/cart/ui/add-to-cart.client';
import type { VendorProductRef } from '@/modules/product/application/product-page-service';
import {
  getCopyTrigger,
  loadScrapedProduct,
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
  // Cached per request: a sku search page already loaded it for its canonical.
  const outcome = await loadScrapedProduct(lookup);
  if (outcome.kind !== 'found') return <ProductUnavailable searchUrl={searchUrl} />;

  const { copyRequest } = outcome;
  after(() => getCopyTrigger().trigger(copyRequest));
  return (
    <ScrapedProductView
      product={outcome.product}
      addToCart={<AddToCart product={purchasableFromScraped(outcome.product)} />}
    />
  );
}
