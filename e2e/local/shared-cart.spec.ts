import { expect, test, type Page } from '@playwright/test';
import { LOCAL_PRODUCTS } from '../support/local-products';

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

const baseUrl = () => {
  const url = process.env.E2E_LOCAL_BASE_URL;
  if (!url) throw new Error('E2E_LOCAL_BASE_URL is not set: the local stack did not start');
  return url;
};

const readStoredCart = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), CART_KEY);

const cartTrigger = (page: Page) => page.getByRole('button', { name: /mini carrito/ });

async function addToCart(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Agregar al carrito' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page.getByRole('status').filter({ hasText: '¡Producto agregado correctamente!' }),
  ).toBeVisible();
}

test.describe('cart shared with PWA Studio (local stack)', () => {
  test('Magento PDP: creates the cart, stores it in the PWA format and updates the mini cart', async ({
    page,
  }) => {
    await page.goto(`${baseUrl()}/${LOCAL_PRODUCTS.magento.routeUrl}`);
    expect(await readStoredCart(page)).toBeNull();

    const before = Date.now();
    await addToCart(page);

    const raw = await readStoredCart(page);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? '') as Record<string, unknown>;
    // Exactly what peregrine BrowserPersistence.setItem('cartId', id) writes: no ttl key.
    expect(Object.keys(stored)).toEqual(['value', 'timeStored']);
    expect(typeof stored.timeStored).toBe('number');
    expect(stored.timeStored as number).toBeGreaterThanOrEqual(before);
    const cartId = JSON.parse(stored.value as string) as unknown;
    expect(cartId).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)).toBeNull();

    await expect(cartTrigger(page)).toHaveAccessibleName(
      'Alternar mini carrito. Tienes 1 artículos en tu carrito.',
    );

    // A second add reuses the stored cart.
    await addToCart(page);
    expect(
      JSON.parse((JSON.parse((await readStoredCart(page)) ?? '') as { value: string }).value),
    ).toBe(cartId);
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 2 artículos/);

    // After a reload the count comes from Magento for the stored cart.
    await page.reload();
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 2 artículos/);

    await cartTrigger(page).click();
    const dialog = page.getByRole('dialog', { name: /^Carrito/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Producto ${LOCAL_PRODUCTS.magento.sku}`)).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Ir a pagar' })).toHaveAttribute(
      'href',
      '/checkout',
    );
    await expect(dialog.getByRole('link', { name: 'Editar carrito' })).toHaveAttribute(
      'href',
      '/cart',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('scraped PDP: adds the vendor product (asin as sku) to the stored cart', async ({
    page,
  }) => {
    await page.goto(`${baseUrl()}/${LOCAL_PRODUCTS.magento.routeUrl}`);
    await addToCart(page);
    const stored = await readStoredCart(page);

    await page.goto(`${baseUrl()}${LOCAL_PRODUCTS.scraped.path}`);
    await addToCart(page);

    // The same cart keeps both products; nothing rewrote the stored id.
    expect(await readStoredCart(page)).toBe(stored);
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 2 artículos/);
    await cartTrigger(page).click();
    await expect(page.getByText(`Producto ${LOCAL_PRODUCTS.scraped.sku}`)).toBeVisible();
  });

  test('recovers a cart id Magento no longer knows by creating a new one', async ({ page }) => {
    await page.goto(`${baseUrl()}/${LOCAL_PRODUCTS.magento.routeUrl}`);
    const stale = JSON.stringify({
      value: JSON.stringify('staleCartId000000000000000000000'),
      timeStored: Date.now(),
    });
    await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
      key: CART_KEY,
      value: stale,
    });
    await page.reload();

    await addToCart(page);

    const stored = JSON.parse((await readStoredCart(page)) ?? '') as { value: string };
    expect(JSON.parse(stored.value)).not.toBe('staleCartId000000000000000000000');
    await expect(cartTrigger(page)).toHaveAccessibleName(/Tienes 1 artículos/);
  });
});
