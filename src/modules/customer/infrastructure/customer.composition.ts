import 'server-only';
import { createMagentoCartGateway } from '@/modules/cart/infrastructure/magento-cart-gateway';
import {
  createCustomerService,
  type CustomerService,
} from '@/modules/customer/application/customer-service';
import { createMagentoCustomerGateway } from '@/modules/customer/infrastructure/magento-customer-gateway';
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
