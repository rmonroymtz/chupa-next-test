import type { RecommendationRepository } from '@/modules/recommendations/application/ports';
import {
  RECOMMENDATION_LIMIT,
  type RecommendationType,
  type RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';

export interface LoadRecommendationsDeps {
  readonly repository: RecommendationRepository;
  readonly logger: { warn(context: Record<string, unknown>, message: string): void };
}

/**
 * Products of one recommendation slider. Never rejects: on any failure the
 * slider is hidden (no products) rather than affecting the page; the Magento
 * client already logs and meters the failed request.
 */
export async function loadRecommendations(
  type: RecommendationType,
  deps: LoadRecommendationsDeps,
): Promise<readonly RecommendedProduct[]> {
  try {
    return await deps.repository.findRandom(type, RECOMMENDATION_LIMIT);
  } catch (error) {
    deps.logger.warn({ type, err: error }, 'recommendations unavailable');
    return [];
  }
}
