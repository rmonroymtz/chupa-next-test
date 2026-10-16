import 'server-only';
import { cache } from 'react';
import { loadRecommendations } from '@/modules/recommendations/application/load-recommendations';
import type {
  RecommendationType,
  RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';
import { createMagentoRecommendationRepository } from '@/modules/recommendations/infrastructure/magento-recommendation-repository';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';
import { getLogger } from '@/shared/observability/logger';

/** Used when `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS` is unset. */
export const DEFAULT_RECOMMENDATIONS_TIMEOUT_MS = 3000;

/**
 * One recommendation slider for the current request, fetched per request
 * (no data cache, like every Magento read). React `cache()` only deduplicates
 * identical calls within one render. Never rejects: failures yield no products.
 */
export const getRecommendations = cache(
  (type: RecommendationType): Promise<readonly RecommendedProduct[]> =>
    loadRecommendations(type, {
      repository: {
        // Built lazily so configuration errors also degrade to a hidden slider.
        findRandom: (sliderType, limit) => {
          const env = getServerEnv();
          return createMagentoRecommendationRepository(getMagentoClient(), {
            timeoutMs: env.MAGENTO_RECOMMENDATIONS_TIMEOUT_MS ?? DEFAULT_RECOMMENDATIONS_TIMEOUT_MS,
            currency: env.MAGENTO_CURRENCY,
          }).findRandom(sliderType, limit);
        },
      },
      logger: { warn: safeWarn },
    }),
);

/** Creates the logger only when needed; a failing logger must not reject the slider. */
function safeWarn(context: Record<string, unknown>, message: string): void {
  try {
    getLogger().child({ component: 'recommendations' }).warn(context, message);
  } catch {
    // Logging is best effort here: the page renders without the slider.
  }
}
