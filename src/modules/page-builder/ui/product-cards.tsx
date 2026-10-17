import Image from 'next/image';
import type { ProductCard } from '@/modules/product/domain/product';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';
import styles from './page-builder.module.css';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
// Grid: 2 columns on phones, 5 from 641px; the carousel shows 2, 4 or 5 cards.
const PRODUCT_IMAGE_SIZES = '(min-width: 961px) 20vw, (min-width: 641px) 25vw, 50vw';

/** A card with an optional review rating (0–5); shown only with `showRating`. */
type RatedProductCard = ProductCard & { readonly rating?: number | null };

interface ProductCardsProps {
  readonly cards: readonly RatedProductCard[];
  readonly appearance: 'grid' | 'carousel';
  /** Review stars above the name (recommendation sliders); off for CMS and search grids. */
  readonly showRating?: boolean;
}

/**
 * Product cards (image, name, price) as listed by the Page Builder `products`
 * content type; category pages use the same grid. Server Component.
 */
export function ProductCards({ cards, appearance, showRating = false }: ProductCardsProps) {
  return (
    <ul className={appearance === 'carousel' ? styles.productCarousel : styles.productGrid}>
      {cards.map((card) => (
        <li key={card.uid}>
          {/* Plain anchor: next/link would prefetch product pages (and their side effects). */}
          <a href={`/${card.relativeUrl}`} className={styles.productCard}>
            <div className={styles.productImage}>
              {card.image ? (
                <Image
                  src={card.image.url}
                  alt={card.image.label ?? card.name}
                  fill
                  sizes={PRODUCT_IMAGE_SIZES}
                  style={{ objectFit: 'contain' }}
                  unoptimized={!isOptimizableImageUrl(card.image.url, REMOTE_PATTERNS)}
                />
              ) : null}
            </div>
            {showRating && card.rating ? <Rating value={card.rating} /> : null}
            <span className={styles.productName}>{card.name}</span>
            <MagentoProductPrice product={card} size="sm" />
          </a>
        </li>
      ))}
    </ul>
  );
}

const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

/**
 * Legacy slider `Stars`: five grey stars with amber ones clipped to the rating
 * (fractions included), so no per-card SVG ids are needed.
 */
function Rating({ value }: { readonly value: number }) {
  const rating = Math.min(value, 5);
  return (
    <div
      role="img"
      aria-label={`Calificación: ${rating.toFixed(1)} de 5 estrellas`}
      className="relative inline-flex w-fit"
    >
      <Stars className="text-ds-neutral-300" />
      <div
        data-rating-fill
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${Math.round((rating / 5) * 100)}%` }}
      >
        <Stars className="text-ds-amber" />
      </div>
    </div>
  );
}

function Stars({ className }: { readonly className: string }) {
  return (
    <span className={`flex gap-px ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} viewBox="0 0 20 20" width={12} height={12} className="shrink-0">
          <path fill="currentColor" d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
