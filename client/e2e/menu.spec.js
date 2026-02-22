import { test, expect } from './fixtures/game.js';
import { MENU, HUD } from './helpers/selectors.js';

test.describe('Main menu', () => {
  test('menu controls are visible', async ({ menuPage: page }) => {
    await expect(page.locator(MENU.create)).toBeVisible();
    await expect(page.locator(MENU.join)).toBeVisible();
    await expect(page.locator(MENU.name)).toBeVisible();
    await expect(page.locator(MENU.code)).toBeVisible();
  });

  test('empty room code join shows error', async ({ menuPage: page }) => {
    await page.click(MENU.join);
    await expect(page.locator(MENU.error)).toBeVisible();
    await expect(page.locator(MENU.error)).toHaveText(/room code/i);
  });

  test('create room enters game', async ({ menuPage: page }) => {
    await page.click(MENU.create);
    await expect(page.locator(HUD.hpBar)).toBeVisible({ timeout: 20_000 });
  });
});
