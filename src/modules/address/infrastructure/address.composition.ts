import 'server-only';
import {
  createAddressService,
  type AddressService,
} from '@/modules/address/application/address-service';
import { createMagentoAddressGateway } from '@/modules/address/infrastructure/magento-address-gateway';
import { getMagentoClient } from '@/shared/graphql/client';
import { defaultObservability } from '@/shared/http/observability';

let service: AddressService | undefined;

/** Process-wide address service. Every call reaches Magento: nothing is cached. */
export function getAddressService(): AddressService {
  service ??= createAddressService({
    gateway: createMagentoAddressGateway(getMagentoClient()),
    ...defaultObservability('address'),
  });
  return service;
}
