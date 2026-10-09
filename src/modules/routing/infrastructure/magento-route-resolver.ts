import 'server-only';
import type { RouteResolver } from '@/modules/routing/application/ports';
import { mapRoute, type RouteDto } from '@/modules/routing/infrastructure/route-mapper';
import { RESOLVE_ROUTE_QUERY } from '@/modules/routing/infrastructure/route.query';
import { getMagentoClient, type MagentoClient } from '@/shared/graphql/client';

interface ResolveRouteData {
  route: RouteDto | null;
}

/** Magento-backed resolver. Client errors propagate unchanged. */
export function createMagentoRouteResolver(client: MagentoClient): RouteResolver {
  return {
    async resolve(routeUrl) {
      const data = await client.request<ResolveRouteData, { url: string }>({
        operationName: 'ResolveURL',
        query: RESOLVE_ROUTE_QUERY,
        variables: { url: routeUrl },
      });
      return mapRoute(data.route, routeUrl);
    },
  };
}

/** Resolver/repository bound to the process-wide Magento client. */
export function getMagentoRouteResolver(): RouteResolver {
  return createMagentoRouteResolver(getMagentoClient());
}
