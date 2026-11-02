import { expect, test, type Locator, type Page } from '@playwright/test';
import { LOCAL_PRODUCTS } from '../support/local-products';

/**
 * Phase 4 pages on the local stack (standalone server + mock Magento): the
 * cart page shares the cart the PDP creates, and the auth screens render. The
 * mock cart prices every item at $100, the shipping estimate at $50 and the
 * free shipping threshold at $500 (`tests/integration/support/mock-backends.ts`).
 */
const baseUrl = () => {
  const url = process.env.E2E_LOCAL_BASE_URL;
  if (!url) throw new Error('E2E_LOCAL_BASE_URL is not set: the local stack did not start');
  return url;
};

const ITEM_NAME = `Producto ${LOCAL_PRODUCTS.magento.sku}`;
const summary = (page: Page) => page.getByRole('complementary', { name: 'Resumen de compra' });
const quantity = (row: Locator) =>
  row.getByRole('spinbutton', { name: `Cantidad de ${ITEM_NAME}` });
const cartTrigger = (page: Page) => page.getByRole('button', { name: /mini carrito/ });

async function addToCart(page: Page): Promise<void> {
  await page.goto(`${baseUrl()}/${LOCAL_PRODUCTS.magento.routeUrl}`);
  const button = page.getByRole('button', { name: 'Agregar al carrito' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page.getByRole('status').filter({ hasText: '¡Producto agregado correctamente!' }),
  ).toBeVisible();
}

test.describe('cart page (local stack)', () => {
  test('a shopper without a cart sees the empty state, noindex', async ({ page }) => {
    const response = await page.goto(`${baseUrl()}/cart`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control'] ?? '').toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continuar comprando →' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('lists the PDP cart, changes the quantity, shows the summary and removes the item', async ({
    page,
  }) => {
    await addToCart(page);
    await page.goto(`${baseUrl()}/cart`);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi carrito' })).toBeVisible();
    const row = page.getByRole('listitem', { name: ITEM_NAME });
    await expect(row).toBeVisible();
    await expect(quantity(row)).toHaveValue('1');
    await expect(summary(page).getByTestId('summary-subtotal')).toContainText('100.00');
    // 100 + the $50 estimate (no shipping method is selected on the cart page).
    await expect(summary(page).getByTestId('summary-shipping')).toContainText('50.00');
    await expect(summary(page).getByTestId('summary-total')).toContainText('150.00');
    await expect(
      summary(page).getByText(/Tu envío es gratuito en compras mayores a/),
    ).toContainText('500.00');
    await expect(summary(page).getByRole('link', { name: 'Proceder al pago' })).toHaveAttribute(
      'href',
      '/checkout',
    );

    await row.getByRole('button', { name: `Aumentar cantidad de ${ITEM_NAME}` }).click();
    await expect(quantity(row)).toHaveValue('2');
    await expect(summary(page).getByTestId('summary-subtotal')).toContainText('200.00');
    await expect(summary(page).getByTestId('summary-total')).toContainText('250.00');
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 2 artículos/);

    // The change survives a reload: Magento (the mock) holds the quantity.
    await page.reload();
    await expect(quantity(row)).toHaveValue('2');

    await row.getByRole('button', { name: `Eliminar ${ITEM_NAME}` }).click();
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 0 artículos/);
  });
});

test.describe('customer screens (local stack)', () => {
  for (const [path, title] of [
    ['/sign-in', 'Inicia sesión'],
    ['/create-account', 'Crear cuenta'],
    ['/forgot-password', 'Recuperar contraseña'],
  ] as const) {
    test(`${path}: 200, noindex, rendered by Next`, async ({ page }) => {
      const response = await page.goto(`${baseUrl()}${path}`);
      expect(response?.status()).toBe(200);
      // `Vary: rsc` only comes from Next (the PWA pages do not send it).
      expect(response?.headers()['vary'] ?? '').toContain('rsc');
      expect(response?.headers()['cache-control'] ?? '').toContain('no-store');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  }

  test('the sign-in links keep a same-site `from` and drop an external one', async ({ page }) => {
    await page.goto(`${baseUrl()}/sign-in?from=/order-history`);
    await expect(
      page.getByRole('link', { name: /Crear cuenta|Regístrate/i }).first(),
    ).toHaveAttribute('href', /from=%2Forder-history/);

    await page.goto(`${baseUrl()}/sign-in?from=https://evil.example/x`);
    const hrefs = await page
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs.some((href) => href.includes('evil.example'))).toBe(false);
  });
});
