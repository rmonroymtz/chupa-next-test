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

async function rejection(promise: Promise<unknown>): Promise<CustomerGatewayError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(CustomerGatewayError);
    return caught as CustomerGatewayError;
  }
  throw new Error('expected a rejection');
}

describe('createMagentoCustomerGateway', () => {
  it('signs in with generateCustomerToken, anonymously, and returns the token', async () => {
    const captured = respondWith({ data: { generateCustomerToken: { token: TOKEN } } });
    const { gateway } = setup();
    await expect(gateway.signIn('a@b.mx', 'pw')).resolves.toBe(TOKEN);
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.body.operationName).toBe('SignIn');
    expect(captured[0]?.body.variables).toEqual({ email: 'a@b.mx', password: 'pw' });
  });

  it('maps a rejected sign-in to invalid_credentials and a missing token to failure', async () => {
    respondWith({
      data: null,
      errors: [
        {
          message:
            'The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.',
        },
      ],
    });
    expect((await rejection(setup().gateway.signIn('a@b.mx', 'bad'))).kind).toBe(
      'invalid_credentials',
    );

    respondWith({ data: { generateCustomerToken: { token: '' } } });
    expect((await rejection(setup().gateway.signIn('a@b.mx', 'pw'))).kind).toBe('failure');
  });

  it('never logs the password or the token', async () => {
    respondWith({ data: null, errors: [{ message: 'boom' }] });
    const { gateway, logLines } = setup();
    await rejection(gateway.signIn('a@b.mx', 'hunter2'));
    expect(JSON.stringify(logLines)).not.toContain('hunter2');
  });

  it('reads the customer with the bearer token', async () => {
    const captured = respondWith({
      data: {
        customer: {
          email: 'a@b.mx',
          firstname: 'Ana',
          lastname: 'Pérez',
          is_subscribed: true,
        },
      },
    });
    const { gateway } = setup();
    await expect(gateway.getCustomer(TOKEN)).resolves.toEqual({
      email: 'a@b.mx',
      firstName: 'Ana',
      lastName: 'Pérez',
      isSubscribed: true,
    });
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('GetCustomerAfterSignIn');
  });

  it('maps a rejected token to not_authorized', async () => {
    respondWith({
      data: null,
      errors: [{ message: "The current customer isn't authorized." }],
    });
    expect((await rejection(setup().gateway.getCustomer(TOKEN))).kind).toBe('not_authorized');
  });

  it('merges the guest cart into the customer cart with the token', async () => {
    const captured = respondWith({ data: { mergeCarts: { id: 'dest' } } });
    const { gateway } = setup();
    await expect(gateway.mergeCarts('guest', 'dest', TOKEN)).resolves.toBeUndefined();
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('MergeCartsAfterSignIn');
    expect(captured[0]?.body.variables).toEqual({
      sourceCartId: 'guest',
      destinationCartId: 'dest',
    });
  });

  it('revokes the token and reports the result', async () => {
    const captured = respondWith({ data: { revokeCustomerToken: { result: true } } });
    const { gateway } = setup();
    await expect(gateway.revokeToken(TOKEN)).resolves.toBe(true);
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('SignOutFromMenu');
  });

  it('wraps transport failures as failure', async () => {
    server.use(http.post(URL, () => HttpResponse.error()));
    expect((await rejection(setup().gateway.revokeToken(TOKEN))).kind).toBe('failure');
  });

  it('sends the reCAPTCHA token of sign-in in the X-ReCaptcha header', async () => {
    const captured = respondWith({ data: { generateCustomerToken: { token: TOKEN } } });
    await setup().gateway.signIn('a@b.mx', 'pw', 'rc-token');
    expect(captured[0]?.recaptcha).toBe('rc-token');
    const anonymous = respondWith({ data: { generateCustomerToken: { token: TOKEN } } });
    await setup().gateway.signIn('a@b.mx', 'pw');
    expect(anonymous[0]?.recaptcha).toBeNull();
  });

  it('creates an account with the legacy CreateAccount operation', async () => {
    const captured = respondWith({ data: { createCustomer: { customer: { email: 'a@b.mx' } } } });
    await setup().gateway.createAccount(
      {
        email: 'a@b.mx',
        firstName: 'Ana',
        lastName: 'Pérez',
        password: 'Pw1!aaaa',
        isSubscribed: false,
      },
      'rc-token',
    );
    expect(captured[0]?.body.operationName).toBe('CreateAccount');
    expect(captured[0]?.body.variables).toEqual({
      email: 'a@b.mx',
      firstname: 'Ana',
      lastname: 'Pérez',
      password: 'Pw1!aaaa',
      is_subscribed: false,
    });
    expect(captured[0]?.recaptcha).toBe('rc-token');
  });

  it('maps account creation errors to email_taken, weak_password or failure', async () => {
    const create = () =>
      setup().gateway.createAccount({
        email: 'a@b.mx',
        firstName: 'A',
        lastName: 'B',
        password: 'x',
        isSubscribed: true,
      });
    respondWith({
      data: null,
      errors: [
        {
          message:
            'A customer with the same email address already exists in an associated website.',
        },
      ],
    });
    expect((await rejection(create())).kind).toBe('email_taken');
    respondWith({
      data: null,
      errors: [
        {
          message:
            'Minimum of different classes of characters in password is 3. Classes of characters: Lower Case, Upper Case, Digits, Special Characters.',
        },
      ],
    });
    expect((await rejection(create())).kind).toBe('weak_password');
    respondWith({ data: null, errors: [{ message: 'boom' }] });
    expect((await rejection(create())).kind).toBe('failure');
  });

  it('requests the password reset email with the reCAPTCHA token', async () => {
    const captured = respondWith({ data: { requestPasswordResetEmail: true } });
    await setup().gateway.requestPasswordReset('a@b.mx', 'rc-token');
    expect(captured[0]?.body.operationName).toBe('requestPasswordResetEmail');
    expect(captured[0]?.body.variables).toEqual({ email: 'a@b.mx' });
    expect(captured[0]?.recaptcha).toBe('rc-token');
  });

  it('reads the reCAPTCHA v3 config and answers null when Magento has none or fails', async () => {
    respondWith({
      data: {
        recaptchaV3Config: {
          website_key: 'site-key',
          badge_position: 'bottomright',
          language_code: 'es',
          forms: ['CUSTOMER_LOGIN', 'CUSTOMER_CREATE'],
        },
      },
    });
    await expect(setup().gateway.getRecaptchaConfig()).resolves.toEqual({
      siteKey: 'site-key',
      badgePosition: 'bottomright',
      languageCode: 'es',
      forms: ['CUSTOMER_LOGIN', 'CUSTOMER_CREATE'],
    });
    respondWith({ data: { recaptchaV3Config: null } });
    await expect(setup().gateway.getRecaptchaConfig()).resolves.toBeNull();
    server.use(http.post(URL, () => HttpResponse.error()));
    await expect(setup().gateway.getRecaptchaConfig()).resolves.toBeNull();
  });
});
