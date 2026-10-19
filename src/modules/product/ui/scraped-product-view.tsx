import type { ReactNode } from 'react';
import type { ScrapedProduct } from '@/modules/product/domain/product';
import { AvailabilityBadge } from '@/modules/product/ui/availability-badge';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import { ProductGallery } from '@/modules/product/ui/product-gallery';
import { ProductPrice } from '@/modules/product/ui/product-price';

/** Prices from the scraper API come in MXN unless it says otherwise. */
const DEFAULT_SCRAPED_CURRENCY = 'MXN';

interface ScrapedProductViewProps {
  readonly product: ScrapedProduct;
  /** Slot for the add-to-cart control (T8). */
  readonly addToCart?: ReactNode;
}

/**
 * PDP for a product Magento does not have yet, from live scraper data.
 * Vendor descriptions are untrusted third-party HTML: they are converted to
 * plain text and rendered as text nodes (escaped by React) instead of being
 * sanitized and injected. That needs no sanitizer dependency, cannot leak
 * markup, and loses nothing for SEO because these pages are noindex.
 */
export function ScrapedProductView({ product, addToCart }: ScrapedProductViewProps) {
  const description = htmlToPlainText(product.descriptionHtml);
  const shortDescription = htmlToPlainText(product.shortDescription);
  const availability =
    product.availability === 'unknown' && !product.itemAvailable
      ? 'out_of_stock'
      : product.availability;

  return (
    <article className="container-padded py-8" data-testid="product-view" data-source="scraper">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((url) => ({ url, label: null }))}
          alt={product.title}
          loadingStrategy="eager"
        />
        <div className="flex flex-col gap-4">
          {product.brand ? <p className="text-sm text-ds-text-secondary">{product.brand}</p> : null}
          <h1 className="text-2xl font-semibold text-ds-neutral-950">{product.title}</h1>
          {product.price ? (
            <ProductPrice
              amount={product.price.current}
              currency={product.price.currency ?? DEFAULT_SCRAPED_CURRENCY}
              previous={product.price.before}
            />
          ) : (
            <p className="text-ds-text">Precio no disponible</p>
          )}
          <AvailabilityBadge availability={availability} />
          {product.condition ? (
            <p className="text-sm text-ds-text-secondary">Condición: {product.condition}</p>
          ) : null}
          {shortDescription ? (
            <p className="whitespace-pre-line text-sm text-ds-text">{shortDescription}</p>
          ) : null}
          <div data-slot="add-to-cart">{addToCart}</div>
        </div>
      </div>
      {description ? (
        <section aria-labelledby="product-description" className="mt-12">
          <h2 id="product-description" className="mb-4 text-xl font-semibold">
            Descripción
          </h2>
          <p className="whitespace-pre-line text-ds-text">{description}</p>
        </section>
      ) : null}
    </article>
  );
}
