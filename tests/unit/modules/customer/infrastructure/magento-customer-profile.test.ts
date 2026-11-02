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
  body: { operationName: string; query: string };
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
        body: (await request.json()) as Captured['body'],
      });
      return HttpResponse.json(payload);
    }),
  );
  return captured;
}

describe('createMagentoCustomerGateway getProfile', () => {
  it('reads the profile with the legacy GetCustomerInformation query and the Bearer token', async () => {
    const captured = respondWith({
      data: {
        customer: {
          id: 7,
          firstname: 'Ana',
          middlename: 'María',
          lastname: 'Pérez',
          email: 'ana@example.mx',
          social_profile_photo: 'https://cdn.example/ana.jpg',
          phone_number: '6643119682',
        },
      },
    });
    const { gateway, logLines } = setup();

    await expect(gateway.getProfile(TOKEN)).resolves.toEqual({
      firstName: 'Ana',
      middleName: 'María',
      lastName: 'Pérez',
      email: 'ana@example.mx',
      phone: '6643119682',
      photoUrl: 'https://cdn.example/ana.jpg',
    });
    expect(captured[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(captured[0]?.body.operationName).toBe('GetCustomerInformation');
    expect(captured[0]?.body.query).toContain('social_profile_photo');
    expect(captured[0]?.body.query).toContain('phone_number');
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });

  it('answers null for a missing phone, photo or middle name', async () => {
    respondWith({
      data: {
        customer: {
          firstname: 'Ana',
          middlename: null,
          lastname: 'Pérez',
          email: 'ana@example.mx',
          social_profile_photo: '',
          phone_number: null,
        },
      },
    });
    const { gateway } = setup();
    await expect(gateway.getProfile(TOKEN)).resolves.toMatchObject({
      middleName: '',
      phone: null,
      photoUrl: null,
    });
  });

  it('maps a token Magento rejects to not_authorized and other failures to failure', async () => {
    respondWith({
      errors: [{ message: "The current customer isn't authorized." }],
      data: { customer: null },
    });
    const { gateway } = setup();
    const rejected = await gateway.getProfile(TOKEN).catch((caught: unknown) => caught);
    expect((rejected as CustomerGatewayError).kind).toBe('not_authorized');

    respondWith({ data: { customer: null } });
    const empty = await gateway.getProfile(TOKEN).catch((caught: unknown) => caught);
    expect((empty as CustomerGatewayError).kind).toBe('failure');
  });
});
