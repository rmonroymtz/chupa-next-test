import { buildRobotsTxt } from '@/modules/seo/domain/robots-txt';
import { getSiteConfig } from '@/modules/seo/infrastructure/site-config';

// The sitemap url depends on the runtime PUBLIC_BASE_URL, not the build env.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(buildRobotsTxt(getSiteConfig().baseUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
