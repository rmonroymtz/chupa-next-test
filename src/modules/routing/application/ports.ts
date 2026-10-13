import type { RouteResolution } from '@/modules/routing/domain/route';

export interface RouteResolver {
  /**
   * Resolves a route url (no leading slash, literal `|`). Rejects when
   * Magento cannot be reached or answers with an error.
   */
  resolve(routeUrl: string): Promise<RouteResolution>;
}
