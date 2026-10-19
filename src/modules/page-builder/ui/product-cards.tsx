import type { ProductCard as ProductCardData } from '@/modules/product/domain/product';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { PRODUCT_GRID_IMAGE_SIZES, ProductCard, ProductGrid } from '@/shared/ui/product-card';
import styles from './page-builder.module.css';

// Carousel: 2 cards on phones, 4 from 641px, 5 from 961px.
const CAROUSEL_IMAGE_SIZES = '(min-width: 961px) 20vw, (min-width: 641px) 25vw, 50vw';

/** A card with an optional review rating (0–5) and brand (search results). */
type ListedProductCard = ProductCardData & {
  readonly rating?: number | null;
  readonly brand?: string | null;
};

interface ProductCardsProps {
  readonly cards: readonly ListedProductCard[];
  readonly appearance: 'grid' | 'carousel';
  /** Review stars of the cards that have a rating (search results, recommendation sliders). */
  readonly showRating?: boolean;
  /** `slider`: the PWA recommendation slider card; `gallery` (default): the PWA Gallery item. */
  readonly card?: 'gallery' | 'slider';
}

/**
 * Product cards (shared `ProductCard`) as listed by the Page Builder `products`
 * content type; category and search pages use the same grid. Server Component.
 */
export function ProductCards({
  cards,
  appearance,
  showRating = false,
  card = 'gallery',
}: ProductCardsProps) {
  const items = cards.map((product) => (
    <li key={product.uid}>
      <ProductCard
        href={`/${product.relativeUrl}`}
        name={product.name}
        image={
          product.image
            ? { src: product.image.url, alt: product.image.label ?? product.name }
            : null
        }
        imageSizes={appearance === 'grid' ? PRODUCT_GRID_IMAGE_SIZES : CAROUSEL_IMAGE_SIZES}
        price={
          <MagentoProductPrice product={product} variant={card === 'slider' ? 'slider' : 'card'} />
        }
        rating={showRating ? product.rating : null}
        brand={product.brand}
        variant={card}
        layout={appearance === 'grid' ? 'grid' : 'plain'}
      />
    </li>
  ));
  if (appearance === 'grid') return <ProductGrid>{items}</ProductGrid>;
  return <ul className={styles.productCarousel}>{items}</ul>;
}
