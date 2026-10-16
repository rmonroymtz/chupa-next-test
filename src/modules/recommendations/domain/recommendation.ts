import type { ProductCard } from '@/modules/product/domain/product';

/**
 * Recommendation sliders shown under single-store search results (legacy
 * `RandomSliders`): Magento `ProductCarouselType` values, in display order.
 * They do not depend on the search query.
 */
export const RECOMMENDATION_TYPES = ['tendency', 'also_bought', 'recently'] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

/** Products asked per slider (legacy `limit: 30`). */
export const RECOMMENDATION_LIMIT = 30;

/** A recommended product, priced and linked like any product card. */
export interface RecommendedProduct extends ProductCard {
  /** Review stars (0–5) as returned; null when absent or zero. */
  readonly rating: number | null;
}
