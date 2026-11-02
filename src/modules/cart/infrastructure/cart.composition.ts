import 'server-only';
import { createCartService, type CartService } from '@/modules/cart/application/cart-service';
import { createMagentoCartGateway } from '@/modules/cart/infrastructure/magento-cart-gateway';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';
import { defaultObservability } from '@/shared/http/observability';

let service: CartService | undefined;

/** Process-wide cart service. Every call reaches Magento: nothing is cached. */
export function getCartService(): CartService {
  service ??= createCartService({
    gateway: createMagentoCartGateway(getMagentoClient(), {
      priceChangeNotices: getServerEnv().CART_REFRESH_BACKEND,
    }),
    ...defaultObservability('cart'),
  });
  return service;
}
