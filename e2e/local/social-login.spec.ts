import { expect, test } from '@playwright/test';
import { MOCK_CUSTOMER_TOKEN } from '../../tests/integration/support/mock-backends';

/**
 * Amasty social login on the local stack: the mock Magento offers Google and
 * Facebook, and its popup page posts the mock customer token to the opener.
 */
const baseUrl = () => {
  const url = process.env.E2E_LOCAL_BASE_URL;
  if (!url) throw new Error('E2E_LOCAL_BASE_URL is not set: the local stack did not start');
  return url;
};

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

test.describe('social login (local stack)', () => {
  test('sign-in and create account show the Google and Facebook buttons', async ({ page }) => {
    for (const path of ['/sign-in', '/create-account']) {
      await page.goto(`${baseUrl()}${path}`);
      await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continuar con Facebook' })).toBeVisible();
    }
  });

  test('Google signs in through the popup, stores the PWA session and returns to from', async ({
    page,
  }) => {
    await page.goto(`${baseUrl()}/sign-in?from=%2Fmy-account%2Fsupport`);
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    const opened = await popup;
    expect(opened.url()).toContain('type=google&isAjax=true&generateToken=true');

    await expect(page).toHaveURL(/\/my-account\/support$/);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY);
    expect(JSON.parse(JSON.parse(stored ?? '{}').value)).toBe(MOCK_CUSTOMER_TOKEN);
  });
});
