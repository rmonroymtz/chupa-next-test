import 'server-only';
import { createMagentoCartGateway } from '@/modules/cart/infrastructure/magento-cart-gateway';
import {
  createCustomerService,
  type CustomerService,
} from '@/modules/customer/application/customer-service';
import {
  createSocialLoginService,
  type SocialLoginService,
} from '@/modules/customer/application/social-login-service';
import { createMagentoCustomerGateway } from '@/modules/customer/infrastructure/magento-customer-gateway';
import { createMagentoSocialLoginGateway } from '@/modules/customer/infrastructure/magento-social-login-gateway';
import { getMagentoClient } from '@/shared/graphql/client';
import { defaultObservability } from '@/shared/http/observability';

let service: CustomerService | undefined;

/** Process-wide customer service. Every call reaches Magento: nothing is cached. */
export function getCustomerService(): CustomerService {
  service ??= createCustomerService({
    customerGateway: createMagentoCustomerGateway(getMagentoClient()),
    cartGateway: createMagentoCartGateway(getMagentoClient()),
    ...defaultObservability('customer'),
  });
  return service;
}

let socialLoginService: SocialLoginService | undefined;

/**
 * Process-wide Amasty social login service. It caches the store-wide Amasty config
 * (5 min, stale served while refreshing); sign-ins and linked accounts always reach Magento.
 */
export function getSocialLoginService(): SocialLoginService {
  socialLoginService ??= createSocialLoginService({
    customerGateway: createMagentoCustomerGateway(getMagentoClient()),
    cartGateway: createMagentoCartGateway(getMagentoClient()),
    socialLoginGateway: createMagentoSocialLoginGateway(getMagentoClient()),
    ...defaultObservability('customer'),
  });
  return socialLoginService;
}
