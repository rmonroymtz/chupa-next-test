import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { CustomerGatewayError } from '@/modules/customer/application/ports';
import { createMagentoSocialLoginGateway } from '@/modules/customer/infrastructure/magento-social-login-gateway';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const TOKEN = 'secret.jwt.token';
const server = setupMswServer();

interface Captured {
  authorization: string | null;
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
  return { gateway: createMagentoSocialLoginGateway(client) };
}

function respondWith(payload: JsonBodyType, status = 200) {
  const captured: Captured[] = [];
  server.use(
    http.post(URL, async ({ request }) => {
      captured.push({
        authorization: request.headers.get('authorization'),
        body: (await request.json()) as Captured['body'],
      });
      return HttpResponse.json(payload, { status });
    }),
  );
  return captured;
}

const STAGING_CONFIG = {
  storeConfig: {
    amsociallogin_general_enabled: true,
    amsociallogin_general_login_position: 'popup',
  },
  amSocialLoginButtonConfig: [
    {
      type: 'google',
      label: 'Google',
      url: 'https://staging.chupaprecios.com.mx/amsociallogin/social/login/?type=google',
    },
    {
      type: 'facebook',
      label: 'Facebook',
      url: 'https://staging.chupaprecios.com.mx/amsociallogin/social/login/?type=facebook',
    },
  ],
};

describe('createMagentoSocialLoginGateway', () => {
  it('reads the Amasty config anonymously and maps the buttons', async () => {
    const captured = respondWith({ data: STAGING_CONFIG });
    const { gateway } = setup();
    await expect(gateway.getConfig()).resolves.toEqual({
      enabled: true,
      positions: ['popup'],
      buttons: [
        {
          type: 'google',
          label: 'Google',
          url: 'https://staging.chupaprecios.com.mx/amsociallogin/social/login/?type=google',
        },
        {
          type: 'facebook',
          label: 'Facebook',
          url: 'https://staging.chupaprecios.com.mx/amsociallogin/social/login/?type=facebook',
        },
      ],
    });
    expect(captured[0]?.authorization).toBeNull();
    expect(captured[0]?.body.operationName).toBe('SocialLoginConfig');
  });

  it('splits several positions and drops buttons without an http(s) url or a type', async () => {
    respondWith({
      data: {
        storeConfig: {
          amsociallogin_general_enabled: true,
          amsociallogin_general_login_position: 'popup, checkout_cart',
        },
        amSocialLoginButtonConfig: [
          { type: 'google', label: 'Google', url: 'javascript:alert(1)' },
          { type: 'facebook', label: 'Facebook', url: 'not a url' },
          { type: '', label: 'X', url: 'https://m.test/x' },
          { type: 'twitter', label: 'Twitter', url: 'http://m.test/login?type=twitter' },
        ],
      },
    });
    const { gateway } = setup();
    await expect(gateway.getConfig()).resolves.toEqual({
      enabled: true,
      positions: ['popup', 'checkout_cart'],
      buttons: [{ type: 'twitter', label: 'Twitter', url: 'http://m.test/login?type=twitter' }],
    });
  });

  it('answers null when Magento fails or lacks the Amasty fields', async () => {
    respondWith({
      data: null,
      errors: [{ message: 'Cannot query field "amSocialLoginButtonConfig"' }],
    });
    await expect(setup().gateway.getConfig()).resolves.toBeNull();
    respondWith({}, 500);
    await expect(setup().gateway.getConfig()).resolves.toBeNull();
  });

  it('reads the linked accounts with the customer token', async () => {
    const captured = respondWith({
      data: {
        amSocialLoginAccountData: [
          { type: 'google', name: 'Google' },
          { type: 'facebook', name: 'Facebook' },
        ],
      },
    });
    const { gateway } = setup();
    await expect(gateway.getLinkedAccounts(TOKEN)).resolves.toEqual([
      { type: 'google', name: 'Google' },
      { type: 'facebook', name: 'Facebook' },
    ]);
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('SocialLoginAccountData');
  });

  it('answers no linked accounts for a null list', async () => {
    respondWith({ data: { amSocialLoginAccountData: null } });
    await expect(setup().gateway.getLinkedAccounts(TOKEN)).resolves.toEqual([]);
  });

  it('maps a rejected token to not_authorized', async () => {
    respondWith({
      data: null,
      errors: [{ message: "The current customer isn't authorized." }],
    });
    const caught = await setup()
      .gateway.getLinkedAccounts(TOKEN)
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(CustomerGatewayError);
    expect((caught as CustomerGatewayError).kind).toBe('not_authorized');
  });
});
