import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const GTM_ID = 'GTM-TEST123';
/** A page that renders the root layout without any CHAPI or route call. */
const PAGE = '/search.html?query=%20&store=amazon';

let backends: MockBackends;
let withoutGtm: RunningNext;
let withGtm: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {},
    storeConfig: storeConfig.data.storeConfig,
    chapi: {},
    chapiDefaultDelayMs: 0,
  });
  const env = {
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL: 'https://chupaprecios.com.mx',
    MAGENTO_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'error',
  };
  // GTM_ID is read at runtime, so one build serves both configurations.
  [withoutGtm, withGtm] = await Promise.all([
    startNext({ ...env, GTM_ID: '' }),
    startNext({ ...env, GTM_ID }),
  ]);
});

afterAll(async () => {
  await Promise.all([withoutGtm?.stop(), withGtm?.stop()]);
  await backends?.close();
});

async function html(server: RunningNext): Promise<string> {
  const response = await fetch(`${server.baseUrl}${PAGE}`, {
    headers: { 'User-Agent': BROWSER_UA },
  });
  expect(response.status).toBe(200);
  return response.text();
}

describe('Google Tag Manager', () => {
  it('is not loaded when GTM_ID is not set', async () => {
    const page = await html(withoutGtm);

    expect(page).not.toContain('googletagmanager.com');
    expect(page).not.toContain('gtm.start');
  });

  it('loads the container snippet at the top of <body> when GTM_ID is set', async () => {
    const page = await html(withGtm);

    const body = page.slice(page.search(/<body[\s>]/));
    const loader = /<script>(\(function\(w,d,s,l,i\)[\s\S]*?)<\/script>/.exec(body);
    expect(loader?.[1]).toContain(`'dataLayer','${GTM_ID}'`);
    expect(loader?.[1]).toContain('https://www.googletagmanager.com/gtm.js?id=');
    // Before the skip link: the dataLayer exists before the rest of the page.
    expect(loader!.index).toBeLessThan(body.indexOf('href="#main-content"'));
    expect(body).toContain(
      `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"`,
    );
  });
});
