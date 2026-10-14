import Image from 'next/image';
import type { ProductCard } from '@/modules/product/domain/product';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';
import styles from './page-builder.module.css';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
// Grid: 2 columns on phones, 5 from 641px; the carousel shows 2, 4 or 5 cards.
const PRODUCT_IMAGE_SIZES = '(min-width: 961px) 20vw, (min-width: 641px) 25vw, 50vw';

interface ProductCardsProps {
  readonly cards: readonly ProductCard[];
  readonly appearance: 'grid' | 'carousel';
}

/**
 * Product cards (image, name, price) as listed by the Page Builder `products`
 * content type; category pages use the same grid. Server Component.
 */
export function ProductCards({ cards, appearance }: ProductCardsProps) {
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
            <span className={styles.productName}>{card.name}</span>
            <MagentoProductPrice product={card} size="sm" />
          </a>
        </li>
      ))}
    </ul>
  );
}
