import 'server-only';
import { cache } from 'react';
import { createBotDetector, type BotDetector } from '@/modules/bot-detection/bot-detector';
import {
  resolveSearchPage,
  type SearchPageDecision,
} from '@/modules/search/application/search-page';
import { searchStore } from '@/modules/search/infrastructure/search.composition';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { getServerEnv } from '@/shared/config/env';
import { defaultObservability } from '@/shared/http/observability';

/** Composition root for the search page: Magento store config and CHAPI. */

let botDetector: BotDetector | undefined;

function isBot(userAgent: string | null): boolean {
  // Same configured rule as the product page: bots never trigger CHAPI.
  botDetector ??= createBotDetector(getServerEnv().BOT_USER_AGENTS);
  return botDetector(userAgent);
}

/**
 * Search page decision for the current request. React `cache()` deduplicates
 * it within one request only; nothing is shared across requests.
 */
export const getSearchPageDecision = cache(
  (search: string, userAgent: string | null): Promise<SearchPageDecision> =>
    resolveSearchPage(
      { search, userAgent },
      {
        isBot,
        searchStore,
        gridPerPage: async () => (await getStoreConfig()).gridPerPage,
        ...defaultObservability('search-page'),
      },
    ),
);
