import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { CustomerGatewayError } from '@/modules/customer/application/ports';
import { createMagentoCustomerGateway } from '@/modules/customer/infrastructure/magento-customer-gateway';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

interface Captured {
  authorization: string | null;
  recaptcha: string | null;
  body: { operationName: string; query: string; variables: Record<string, unknown> };
}

function setup() {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs: 500,
    storeCode: 'default',
    currency: 'MXN',
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway: createMagentoCustomerGateway(client), ...observability };
}

function respondWith(payload: JsonBodyType, captured: Captured[] = []) {
  server.use(
    http.post(URL, async ({ request }) => {
      captured.push({
        authorization: request.headers.get('authorization'),
        recaptcha: request.headers.get('x-recaptcha'),
        body: (await request.json()) as Captured['body'],
      });
      return HttpResponse.json(payload);
    }),
  );
  return captured;
}

const kindOf = async (promise: Promise<unknown>) =>
  ((await promise.catch((caught: unknown) => caught)) as CustomerGatewayError).kind;

describe('createMagentoCustomerGateway resetPassword', () => {
  it('sends the legacy resetPassword mutation with the link token and the reCAPTCHA token', async () => {
    const captured = respondWith({ data: { resetPassword: true } });
    const { gateway, logLines } = setup();

    await expect(
      gateway.resetPassword('ana@example.mx', 'a1b2c3', 'Brand-new2!', 'rc-token'),
    ).resolves.toBeUndefined();
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.recaptcha).toBe('rc-token');
    expect(captured[0]?.body.operationName).toBe('resetPassword');
    expect(captured[0]?.body.variables).toEqual({
      email: 'ana@example.mx',
      token: 'a1b2c3',
      newPassword: 'Brand-new2!',
    });
    expect(captured[0]?.body.query).toContain('resetPasswordToken: $token');
    const logged = JSON.stringify(logLines);
    for (const secret of ['Brand-new2!', 'a1b2c3']) expect(logged).not.toContain(secret);
  });

  it('maps a mismatched or expired token to invalid_token and a weak password to weak_password', async () => {
    const { gateway } = setup();
    const call = () => gateway.resetPassword('a@b.mx', 't', 'p', null);

    respondWith({
      errors: [{ message: 'The password token is mismatched. Reset and try again.' }],
      data: null,
    });
    expect(await kindOf(call())).toBe('invalid_token');

    respondWith({
      errors: [{ message: 'The password token is expired. Reset and try again.' }],
      data: null,
    });
    expect(await kindOf(call())).toBe('invalid_token');

    respondWith({
      errors: [{ message: 'Minimum of different classes of characters in password is 3.' }],
      data: null,
    });
    expect(await kindOf(call())).toBe('weak_password');

    respondWith({ errors: [{ message: 'Internal server error' }], data: null });
    expect(await kindOf(call())).toBe('failure');
  });

  it('fails when Magento does not confirm the reset', async () => {
    respondWith({ data: { resetPassword: false } });
    expect(await kindOf(setup().gateway.resetPassword('a@b.mx', 't', 'p', null))).toBe('failure');
  });
});
