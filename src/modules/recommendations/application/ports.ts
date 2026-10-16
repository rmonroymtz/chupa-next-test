import type {
  RecommendationType,
  RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';

export interface RecommendationRepository {
  /** Up to `limit` products of one slider type; rejects when Magento is unavailable. */
  findRandom(type: RecommendationType, limit: number): Promise<RecommendedProduct[]>;
}
