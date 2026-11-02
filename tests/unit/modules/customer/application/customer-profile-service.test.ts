import { describe, expect, it, vi } from 'vitest';
import type { CartGateway } from '@/modules/cart/application/ports';
import { createCustomerService } from '@/modules/customer/application/customer-service';
import {
  CustomerGatewayError,
  type CustomerGateway,
  type CustomerProfile,
} from '@/modules/customer/application/ports';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'secret.jwt.token';
const PROFILE: CustomerProfile = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: null,
  photoUrl: null,
};

function setup(getProfile: CustomerGateway['getProfile']) {
  const observability = createCapturingObservability();
  const service = createCustomerService({
    customerGateway: { getProfile } as unknown as CustomerGateway,
    cartGateway: {} as unknown as CartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, ...observability };
}

describe('customer service getProfile', () => {
  it('answers the profile for a valid token', async () => {
    const getProfile = vi.fn().mockResolvedValue(PROFILE);
    const { service } = setup(getProfile);
    expect(await service.getProfile({ token: TOKEN })).toEqual({ status: 'ok', profile: PROFILE });
    expect(getProfile).toHaveBeenCalledWith(TOKEN);
  });

  it('reports a rejected token as not_authorized', async () => {
    const { service } = setup(
      vi.fn().mockRejectedValue(new CustomerGatewayError('not_authorized', 'no')),
    );
    expect(await service.getProfile({ token: TOKEN })).toEqual({ status: 'not_authorized' });
  });

  it('reports other failures as failed and never logs the token', async () => {
    const { service, logLines } = setup(
      vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'down')),
    );
    expect(await service.getProfile({ token: TOKEN })).toEqual({ status: 'failed' });
    expect(logLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });
});
