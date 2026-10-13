import 'server-only';
import type { OrganizationConfig } from '@/modules/seo/domain/site-structured-data';
import { getServerEnv } from '@/shared/config/env';

/** Site-wide SEO settings from the validated environment. */
export function getSiteConfig(): OrganizationConfig {
  const env = getServerEnv();
  return {
    baseUrl: env.PUBLIC_BASE_URL,
    logoUrl: env.ORGANIZATION_LOGO_URL ?? null,
    sameAs: env.ORGANIZATION_SAME_AS,
  };
}
