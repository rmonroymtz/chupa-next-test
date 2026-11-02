import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { CustomerGatewayError } from '@/modules/customer/application/ports';
import { createMagentoCustomerGateway } from '@/modules/customer/infrastructure/magento-customer-gateway';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const TOKEN = 'secret.jwt.token';
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

describe('createMagentoCustomerGateway profile updates', () => {
  it('updates the phone with the legacy UpdateCustomerPhone mutation', async () => {
    const captured = respondWith({
      data: { updateCustomer: { customer: { phone_number: '6643119682' } } },
    });
    const { gateway } = setup();

    await expect(gateway.updatePhone(TOKEN, '6643119682')).resolves.toBeUndefined();
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('UpdateCustomerPhone');
    expect(captured[0]?.body.variables).toEqual({ phone: '6643119682' });
    expect(captured[0]?.body.query).toContain('phone_number');
  });

  it('updates name and email with SetCustomerInformation, sending the current password', async () => {
    const captured = respondWith({
      data: { updateCustomer: { customer: { email: 'new@example.mx' } } },
    });
    const { gateway, logLines } = setup();

    await gateway.updateIdentity(TOKEN, {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'new@example.mx',
      password: 'Current1!',
    });
    expect(captured[0]?.body.operationName).toBe('SetCustomerInformation');
    expect(captured[0]?.body.variables).toEqual({
      customerInput: {
        firstname: 'Ana',
        lastname: 'Pérez',
        email: 'new@example.mx',
        password: 'Current1!',
      },
    });
    expect(JSON.stringify(logLines)).not.toContain('Current1!');
  });

  it('changes the password with changeCustomerPassword and the CUSTOMER_EDIT token', async () => {
    const captured = respondWith({
      data: { changeCustomerPassword: { email: 'ana@example.mx' } },
    });
    const { gateway, logLines } = setup();

    await gateway.changePassword(TOKEN, 'Current1!', 'Brand-new2!', 'rc-token');
    expect(captured[0]?.body.operationName).toBe('ChangeCustomerPassword');
    expect(captured[0]?.body.variables).toEqual({
      currentPassword: 'Current1!',
      newPassword: 'Brand-new2!',
    });
    expect(captured[0]?.recaptcha).toBe('rc-token');
    expect(JSON.stringify(logLines)).not.toContain('Brand-new2!');
    expect(JSON.stringify(logLines)).not.toContain('Current1!');
  });

  it('maps Magento errors to wrong_password, email_taken, weak_password and not_authorized', async () => {
    const { gateway } = setup();
    const identity = { firstName: 'A', lastName: 'B', email: 'a@b.mx', password: 'x' };

    respondWith({
      errors: [
        { message: "The password doesn't match this account. Verify the password and try again." },
      ],
      data: null,
    });
    expect(await kindOf(gateway.updateIdentity(TOKEN, identity))).toBe('wrong_password');

    respondWith({
      errors: [
        {
          message:
            'A customer with the same email address already exists in an associated website.',
        },
      ],
      data: null,
    });
    expect(await kindOf(gateway.updateIdentity(TOKEN, identity))).toBe('email_taken');

    respondWith({
      errors: [{ message: 'Minimum of different classes of characters in password is 3.' }],
      data: null,
    });
    expect(await kindOf(gateway.changePassword(TOKEN, 'a', 'b', null))).toBe('weak_password');

    respondWith({ errors: [{ message: "The current customer isn't authorized." }], data: null });
    expect(await kindOf(gateway.updatePhone(TOKEN, '1'))).toBe('not_authorized');

    respondWith({ errors: [{ message: 'Internal server error' }], data: null });
    expect(await kindOf(gateway.updatePhone(TOKEN, '1'))).toBe('failure');
  });
});
