import { expect, test, type Page } from '@playwright/test';
import { MOCK_CUSTOMER_TOKEN } from '../../tests/integration/support/mock-backends';

/**
 * Phase 5 account pages on the local stack (standalone server + mock Magento):
 * the guard, the dashboard, the support page and the legacy aliases. The mock
 * accepts `MOCK_CUSTOMER_TOKEN` and rejects any other token.
 */
const baseUrl = () => {
  const url = process.env.E2E_LOCAL_BASE_URL;
  if (!url) throw new Error('E2E_LOCAL_BASE_URL is not set: the local stack did not start');
  return url;
};

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

/** The PWA envelope (`{value, timeStored, ttl}`, ttl 3600 s) PWA Studio writes for the token. */
async function signInWith(page: Page, token: string): Promise<void> {
  await page.goto(`${baseUrl()}/sign-in`);
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key: TOKEN_KEY,
    value: JSON.stringify({
      value: JSON.stringify(token),
      timeStored: Date.now(),
      ttl: 3600,
    }),
  });
}

test.describe('account pages (local stack)', () => {
  test('a guest is sent to sign in and comes back to the page it asked for', async ({ page }) => {
    await page.goto(`${baseUrl()}/my-account/support`);
    await expect(page).toHaveURL(/\/sign-in\?from=%2Fmy-account%2Fsupport$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeVisible();
  });

  test('a signed-in shopper sees the dashboard with the greeting, the cards and the breadcrumb', async ({
    page,
  }) => {
    await signInWith(page, MOCK_CUSTOMER_TOKEN);
    const response = await page.goto(`${baseUrl()}/my-account`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control'] ?? '').toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    await expect(page.getByRole('heading', { level: 1, name: 'MI CUENTA' })).toBeVisible();
    await expect(page.getByText('Hola, Ana Pérez')).toBeVisible();
    const cards = page.getByRole('list', { name: 'Secciones de tu cuenta' }).getByRole('link');
    await expect(cards).toHaveCount(6);
    await expect(cards.first()).toHaveAttribute('href', '/my-account/order-history');
    await expect(cards.last()).toHaveAttribute('href', '/my-account/account-information');
    await expect(
      page.getByRole('navigation', { name: 'Ruta de navegación' }).getByText('Mi cuenta'),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('the support page is static: phone, WhatsApp and the chat buttons', async ({ page }) => {
    await signInWith(page, MOCK_CUSTOMER_TOKEN);
    await page.goto(`${baseUrl()}/my-account/support`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'ATENCIÓN A CLIENTES' }),
    ).toBeVisible();
    await expect(page.getByText('Lunes a sábados: 09:00hs a 18:00hs')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Click para ir a Whatsapp web' })).toHaveAttribute(
      'href',
      'https://wa.me/526643119682',
    );
    await expect(page.getByRole('button', { name: 'Chupaprecios' })).toBeVisible();
    const crumbs = page.getByRole('navigation', { name: 'Ruta de navegación' });
    await expect(crumbs.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
      'href',
      '/my-account',
    );
  });

  test('a token Magento rejects is dropped and the shopper goes to sign in', async ({ page }) => {
    await signInWith(page, 'mock.expired.token');
    await page.goto(`${baseUrl()}/my-account`);

    await expect(page).toHaveURL(/\/sign-in\?from=%2Fmy-account$/);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  });

  for (const alias of [
    '/order-history',
    '/account-information',
    '/address-book',
    '/saved-payments',
    '/quotes',
  ]) {
    test(`the legacy alias ${alias} redirects under /my-account and keeps the query`, async ({
      request,
    }) => {
      const response = await request.get(`${baseUrl()}${alias}?callbackUrl=%2Fcheckout`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers()['location']).toBe(`/my-account${alias}?callbackUrl=%2Fcheckout`);
    });
  }
});
