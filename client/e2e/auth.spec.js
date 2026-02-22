import { test, expect } from './fixtures/game.js';
import { AUTH, MENU } from './helpers/selectors.js';

test.describe('Auth screen', () => {
  test('renders on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(AUTH.guest)).toBeVisible();
    await expect(page.locator(AUTH.submit)).toBeVisible();
    await expect(page.locator(AUTH.username)).toBeVisible();
  });

  test('guest login navigates to main menu', async ({ page }) => {
    await page.goto('/');
    await page.click(AUTH.guest);
    await expect(page.locator(MENU.create)).toBeVisible();
  });

  test('empty login shows error', async ({ page }) => {
    await page.goto('/');
    await page.click(AUTH.submit);
    await expect(page.locator(AUTH.error)).toBeVisible();
    await expect(page.locator(AUTH.error)).toHaveText(/fill in all fields/i);
  });
});
