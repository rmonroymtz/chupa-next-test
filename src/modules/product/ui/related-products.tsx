import type { RelatedProduct } from '@/modules/product/domain/product';
import { Price } from '@/shared/ui/price';
import { PRODUCT_GRID_IMAGE_SIZES, ProductCard, ProductGrid } from '@/shared/ui/product-card';

interface RelatedProductsProps {
  readonly items: readonly RelatedProduct[];
  readonly heading: string;
}

/**
 * Alternatives shown on the PDP, in the shared product grid and card. Plain
 * anchors on purpose (`ProductCard`): `next/link` would prefetch product pages,
 * and a prefetched missing product would query the scraper API and fire the
 * copy mutation without a real visit.
 */
export function RelatedProducts({ items, heading }: RelatedProductsProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="related-products" className="mt-12">
      <h2 id="related-products" className="mb-4 text-xl font-semibold">
        {heading}
      </h2>
      <ProductGrid>
        {items.map((item) => (
          <li key={item.uid}>
            <ProductCard
              href={`/${item.relativeUrl}`}
              name={item.name}
              image={
                item.image ? { src: item.image.url, alt: item.image.label ?? item.name } : null
              }
              imageSizes={PRODUCT_GRID_IMAGE_SIZES}
              price={
                item.price ? (
                  <Price amount={item.price.amount} currency={item.price.currency} />
                ) : null
              }
            />
          </li>
        ))}
      </ProductGrid>
    </section>
  );
}
