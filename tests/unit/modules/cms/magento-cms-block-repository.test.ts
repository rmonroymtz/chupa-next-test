import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCmsBlockRepository } from '@/modules/cms/infrastructure/magento-cms-block-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import blocks from '../../../fixtures/page-builder/cms-blocks.sliders.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

const repository = () =>
  createMagentoCmsBlockRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

const slider = blocks.items.find((item) => item.identifier === 'top-banner-slider')!;

const answer = (cmsBlocks: unknown) =>
  server.use(http.post(URL, () => HttpResponse.json({ data: { cmsBlocks } })));

describe('MagentoCmsBlockRepository', () => {
  it('maps the live top-banner-slider block and asks for that identifier only', async () => {
    let body: { operationName?: string; variables?: Record<string, unknown> } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ data: { cmsBlocks: { items: [slider] } } });
      }),
    );

    const block = await repository().findByIdentifier('top-banner-slider');

    expect(body.operationName).toBe('CmsBlocks');
    expect(body.variables).toEqual({ identifiers: ['top-banner-slider'] });
    expect(block).toEqual({
      identifier: 'top-banner-slider',
      title: 'Top Banner Slider',
      content: slider.content,
    });
  });

  it('returns null for a block Magento reports as missing (or disabled)', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({
          errors: [{ message: 'The CMS block with the "gone" ID doesn\'t exist.' }],
          data: { cmsBlocks: { items: [null] } },
        }),
      ),
    );
    await expect(repository().findByIdentifier('gone')).resolves.toBeNull();
  });

  it('returns null when Magento omits the block from the items', async () => {
    answer({ items: [] });
    await expect(repository().findByIdentifier('gone')).resolves.toBeNull();
  });

  it('returns null for a null item or an item without an identifier', async () => {
    answer({ items: [null, { identifier: ' ', title: 'x', content: '<p>x</p>' }] });
    await expect(repository().findByIdentifier('gone')).resolves.toBeNull();
  });

  it('keeps a block with blank content as an empty string (it exists; there is nothing to render)', async () => {
    answer({ items: [{ identifier: 'vacio', title: null, content: null }] });
    await expect(repository().findByIdentifier('vacio')).resolves.toEqual({
      identifier: 'vacio',
      title: '',
      content: '',
    });
  });

  it('rejects on an outage, so it is never rendered as success', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    await expect(repository().findByIdentifier('top-banner-slider')).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('rejects on other GraphQL errors', async () => {
    server.use(
      http.post(URL, () => HttpResponse.json({ errors: [{ message: 'Internal server error' }] })),
    );
    await expect(repository().findByIdentifier('x')).rejects.toMatchObject({ kind: 'graphql' });
  });

  it.each([
    ['a null cmsBlocks', null],
    ['cmsBlocks without items', {}],
  ])('rejects on an invalid response: %s', async (_, cmsBlocks) => {
    answer(cmsBlocks);
    await expect(repository().findByIdentifier('x')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
