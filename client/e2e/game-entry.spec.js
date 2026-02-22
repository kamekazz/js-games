import { test, expect } from './fixtures/game.js';
import { HUD, GAME } from './helpers/selectors.js';

test.describe('Game entry', () => {
  test('HUD elements are visible', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.hpBar)).toBeVisible();
    await expect(page.locator(HUD.staminaBar)).toBeVisible();
    await expect(page.locator(HUD.weaponName)).toBeVisible();
    await expect(page.locator(HUD.ammo)).toBeVisible();
    await expect(page.locator(HUD.weaponHints)).toBeVisible();
  });

  test('initial weapon is Pistol', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.weaponName)).toHaveText('Pistol');
  });

  test('initial ammo is 8/8', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.ammo)).toHaveText('8 / 8');
  });

  test('night 1 starts', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.night)).toContainText('Night 1', { timeout: 30_000 });
  });

  test('canvas is rendered', async ({ gamePage: page }) => {
    await expect(page.locator(GAME.canvas)).toBeVisible();
  });
});
