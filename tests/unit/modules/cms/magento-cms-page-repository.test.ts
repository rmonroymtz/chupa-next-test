import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCmsPageRepository } from '@/modules/cms/infrastructure/magento-cms-page-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import aviso from '../../../fixtures/page-builder/cms-page.aviso-privacidad.json';
import home from '../../../fixtures/page-builder/cms-page.home.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

const repository = () =>
  createMagentoCmsPageRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

describe('MagentoCmsPageRepository', () => {
  it('maps the live aviso-privacidad page and sends the identifier', async () => {
    let body: { operationName?: string; variables?: Record<string, unknown> } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ data: { cmsPage: aviso.data.route } });
      }),
    );

    const page = await repository().findByIdentifier('aviso-privacidad');

    expect(body.operationName).toBe('CmsPage');
    expect(body.variables).toEqual({ identifier: 'aviso-privacidad' });
    expect(page).toEqual({
      identifier: 'aviso-privacidad',
      urlKey: 'aviso-privacidad',
      relativeUrl: 'aviso-privacidad',
      title: 'Aviso de privacidad',
      contentHeading: null,
      content: aviso.data.route.content,
      metaTitle: 'Aviso de privacidad',
      metaDescription: 'Aviso de privacidad',
      metaKeywords: 'Aviso de privacidad',
      pageLayout: 'cms-full-width',
    });
  });

  it('falls back to the url key when Magento returns no relative url (home)', async () => {
    server.use(http.post(URL, () => HttpResponse.json(home)));
    const page = await repository().findByIdentifier('home');
    expect(page).toMatchObject({ relativeUrl: 'home', contentHeading: 'Home Page' });
  });

  it('returns null for a page Magento reports as missing', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({
          errors: [{ message: 'The CMS page with the "gone" ID doesn\'t exist.' }],
          data: { cmsPage: null },
        }),
      ),
    );
    await expect(repository().findByIdentifier('gone')).resolves.toBeNull();
  });

  it('returns null for a null cmsPage', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { cmsPage: null } })));
    await expect(repository().findByIdentifier('gone')).resolves.toBeNull();
  });

  it('rejects on an outage, so it is never rendered as a 404', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    await expect(repository().findByIdentifier('aviso-privacidad')).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('rejects on other GraphQL errors', async () => {
    server.use(
      http.post(URL, () => HttpResponse.json({ errors: [{ message: 'Internal server error' }] })),
    );
    await expect(repository().findByIdentifier('x')).rejects.toMatchObject({ kind: 'graphql' });
  });
});
