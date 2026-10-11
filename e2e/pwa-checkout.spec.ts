import { expect, test } from '@playwright/test';

/**
 * Real environment only: a Next PDP adds to cart, then PWA Studio's checkout
 * (same domain) must load with that cart. Creates a real guest cart.
 *
 *   E2E_BASE_URL=https://staging.example.com \
 *   E2E_PRODUCT_PATH=/amazon-B0XXXXXXX-some-product.html pnpm test:e2e
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();
const productPath = process.env.E2E_PRODUCT_PATH?.trim();
const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';

test.skip(!baseUrl, 'Set E2E_BASE_URL (and E2E_PRODUCT_PATH) to run against a real environment');

test('Next PDP → add to cart → PWA Studio checkout keeps the cart', async ({ page }) => {
  test.skip(!productPath, 'Set E2E_PRODUCT_PATH to an in-stock product served by Next');

  await page.goto(productPath ?? '/');
  // Served by Next: the add-to-cart island is ours.
  await expect(page.getByTestId('add-to-cart')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('¡Producto agregado correctamente!')).toBeVisible({
    timeout: 20_000,
  });
  const cartIdBefore = await page.evaluate((key) => window.localStorage.getItem(key), CART_KEY);
  expect(cartIdBefore).not.toBeNull();

  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');

  // PWA Studio replaces an id it cannot use; the same id means it accepted the cart.
  const cartIdAfter = await page.evaluate((key) => window.localStorage.getItem(key), CART_KEY);
  expect(JSON.parse(cartIdAfter ?? '{}').value).toBe(JSON.parse(cartIdBefore ?? '{}').value);
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText('No hay artículos en tu carrito.')).toHaveCount(0);
});
