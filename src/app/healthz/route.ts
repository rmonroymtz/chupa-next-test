/**
 * Liveness probe for the load balancer and the container health check: the
 * Node process is up and serving. It deliberately checks no dependency
 * (Magento, the scraper API): a slow or failing Magento would otherwise mark
 * every task unhealthy at once and the orchestrator would replace healthy
 * containers in a loop, turning a partial outage into a full one. Pages
 * already answer 5xx when Magento fails.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
