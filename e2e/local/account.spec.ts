import { expect, test, type Page } from '@playwright/test';
import {
  MOCK_CUSTOMER_PASSWORD,
  MOCK_CUSTOMER_TOKEN,
  MOCK_RESET_TOKEN,
} from '../../tests/integration/support/mock-backends';

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

test.describe('profile (local stack)', () => {
  test('shows the profile and opens the edit form with the data filled in', async ({ page }) => {
    await signInWith(page, MOCK_CUSTOMER_TOKEN);
    await page.goto(`${baseUrl()}/my-account/account-information`);

    await expect(page.getByRole('heading', { level: 1, name: 'MI PERFIL' })).toBeVisible();
    await expect(page.getByText('Ana Pérez', { exact: true })).toBeVisible();
    await expect(page.getByText('+52 6643119682')).toBeVisible();

    await page.getByRole('link', { name: 'EDITAR DATOS' }).click();
    await expect(page).toHaveURL(/\/my-account\/edit-account-information$/);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana');
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('ana.perez@example.mx');
    await expect(page.getByLabel('Teléfono')).toHaveValue('6643119682');
  });

  test('saving a new phone goes back to the profile with the new number', async ({ page }) => {
    await signInWith(page, MOCK_CUSTOMER_TOKEN);
    await page.goto(`${baseUrl()}/my-account/edit-account-information`);

    await page.getByLabel('Teléfono').fill('5512345678');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page).toHaveURL(/\/my-account\/account-information$/);
    await expect(page.getByText('+52 5512345678')).toBeVisible();
  });

  test('changing the email needs the right current password', async ({ page }) => {
    await signInWith(page, MOCK_CUSTOMER_TOKEN);
    await page.goto(`${baseUrl()}/my-account/edit-account-information`);

    await page.getByLabel('Correo electrónico').fill('nueva@example.mx');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await page.getByLabel('Contraseña actual').fill('not-my-password');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();

    await page.getByLabel('Contraseña actual').fill(MOCK_CUSTOMER_PASSWORD);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page).toHaveURL(/\/my-account\/account-information$/);
    await expect(page.getByText('nueva@example.mx')).toBeVisible();
  });
});

test.describe('reset password link (local stack)', () => {
  const resetUrl = (token?: string) =>
    `${baseUrl()}/customer/account/createPassword${token ? `?token=${token}` : ''}`;

  test('a url without a token shows the legacy error, noindex and no Referer', async ({ page }) => {
    const response = await page.goto(resetUrl());
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control'] ?? '').toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    await expect(
      page.getByText('Uh oh, algo salió mal. Verifica el enlace o inténtalo de nuevo.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  test('the emailed link saves the new password and shows the confirmation', async ({ page }) => {
    await page.goto(resetUrl(MOCK_RESET_TOKEN));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }),
    ).toBeVisible();

    await page.getByLabel('Correo electrónico').fill('ana.perez@example.mx');
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('Brand-new2!');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();

    await expect(
      page.getByText(
        'Tu nueva contraseña ha sido guardada. Por favor usa esta contraseña para iniciar sesión en tu Cuenta.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  test('an expired link asks for a new one', async ({ page }) => {
    await page.goto(resetUrl('expiredtoken000000000000'));
    await page.getByLabel('Correo electrónico').fill('ana.perez@example.mx');
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('Brand-new2!');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();

    await expect(
      page.getByText(
        'El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo.',
      ),
    ).toBeVisible();
  });
});
