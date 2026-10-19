import type { ProductCard as ProductCardData } from '@/modules/product/domain/product';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { PRODUCT_GRID_IMAGE_SIZES, ProductCard, ProductGrid } from '@/shared/ui/product-card';
import styles from './page-builder.module.css';

// Page Builder carousel (PWA react-slick `Products`): 2 cards up to 640px, 3 to 960px, 4 to 1279px, 5 from 1280px.
const CAROUSEL_IMAGE_SIZES =
  '(min-width: 1280px) 20vw, (min-width: 961px) 25vw, (min-width: 641px) 34vw, 50vw';
// Recommendation sliders (PWA `RandomSliders` embla track): 2 cards below 640px, 3 to 1023px, 5 from 1024px.
const SLIDER_IMAGE_SIZES = '(min-width: 1024px) 20vw, (min-width: 640px) 34vw, 50vw';

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
        imageSizes={imageSizes(appearance, card)}
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
  // `slider`: the embla track of the recommendation sliders (the caller wraps it in the carousel).
  return (
    <ul className={card === 'slider' ? styles.sliderCarousel : styles.productCarousel}>{items}</ul>
  );
}

function imageSizes(
  appearance: ProductCardsProps['appearance'],
  card: NonNullable<ProductCardsProps['card']>,
): string {
  if (appearance === 'grid') return PRODUCT_GRID_IMAGE_SIZES;
  return card === 'slider' ? SLIDER_IMAGE_SIZES : CAROUSEL_IMAGE_SIZES;
}
