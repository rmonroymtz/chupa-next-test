import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GtmScript } from '@/modules/analytics/ui/gtm-script';
import { resetServerEnvForTests } from '@/shared/config/env';

beforeEach(() => {
  vi.stubEnv('MAGENTO_GRAPHQL_URL', 'https://magento.example.com/graphql');
  vi.stubEnv('PUBLIC_BASE_URL', 'https://chupaprecios.com.mx');
  vi.stubEnv('CHAPI_BASE_URL', 'https://chapi.example.com');
  vi.stubEnv('GTM_ID', '');
  resetServerEnvForTests();
});

describe('GtmScript', () => {
  it('renders nothing when GTM_ID is not set', () => {
    expect(renderToStaticMarkup(<GtmScript />)).toBe('');
  });

  it('renders the GTM snippet and the noscript iframe for the container', () => {
    vi.stubEnv('GTM_ID', 'GTM-AB12CD');
    resetServerEnvForTests();

    const html = renderToStaticMarkup(<GtmScript />);

    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    // The dataLayer exists before gtm.js loads, so early pushes are never lost.
    expect(script).toContain('w[l]=w[l]||[]');
    expect(script).toContain("'gtm.start'");
    expect(script).toContain('https://www.googletagmanager.com/gtm.js?id=');
    expect(script).toContain("'dataLayer','GTM-AB12CD'");
    expect(html).toContain(
      '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-AB12CD"',
    );
    expect(html).toContain('height="0" width="0"');
    expect(html).toContain('display:none;visibility:hidden');
  });
});
