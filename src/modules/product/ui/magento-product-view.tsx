import type { ReactNode } from 'react';
import type { MagentoProduct } from '@/modules/product/domain/product';
import { AvailabilityBadge } from '@/modules/product/ui/availability-badge';
import { ProductGallery } from '@/modules/product/ui/product-gallery';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { RelatedProducts } from '@/modules/product/ui/related-products';

interface MagentoProductViewProps {
  readonly product: MagentoProduct;
  /** Slot for the add-to-cart control (T8). */
  readonly addToCart?: ReactNode;
  /** Slot for JSON-LD structured data. */
  readonly structuredData?: ReactNode;
}

/**
 * PDP for a product stored in Magento, fully server-rendered for every
 * visitor. Description HTML comes from Magento (our own catalog, trusted),
 * so it is rendered as markup.
 */
export function MagentoProductView({
  product,
  addToCart,
  structuredData,
}: MagentoProductViewProps) {
  const outOfStock = product.availability === 'out_of_stock';
  return (
    <article className="container-padded py-8" data-testid="product-view" data-source="magento">
      {structuredData}
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} loadingStrategy="preload" />
        <div className="flex flex-col gap-4">
          {product.brand ? <p className="text-sm text-ds-text-secondary">{product.brand}</p> : null}
          <h1 className="text-2xl font-semibold text-ds-neutral-950">{product.name}</h1>
          <MagentoProductPrice product={product} />
          <AvailabilityBadge availability={product.availability} />
          {outOfStock ? (
            <p className="text-sm text-ds-text">
              Este producto está agotado por ahora. Revisa las alternativas más abajo.
            </p>
          ) : null}
          {product.shortDescriptionHtml ? (
            <div
              className="text-sm text-ds-text"
              dangerouslySetInnerHTML={{ __html: product.shortDescriptionHtml }}
            />
          ) : null}
          <div data-slot="add-to-cart">{addToCart}</div>
        </div>
      </div>
      {product.descriptionHtml ? (
        <section aria-labelledby="product-description" className="mt-12">
          <h2 id="product-description" className="mb-4 text-xl font-semibold">
            Descripción
          </h2>
          <div
            className="space-y-2 text-ds-text"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        </section>
      ) : null}
      <RelatedProducts
        items={product.related}
        heading={outOfStock ? 'Alternativas disponibles' : 'Productos relacionados'}
      />
    </article>
  );
}
