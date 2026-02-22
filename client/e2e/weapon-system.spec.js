import { test, expect } from './fixtures/game.js';
import { HUD } from './helpers/selectors.js';

test.describe('Weapon system', () => {
  test('weapon hints show locked slots', async ({ gamePage: page }) => {
    const hints = page.locator(HUD.weaponHints);
    await expect(hints).toContainText('[1] Pistol');
    await expect(hints).toContainText('[2] ???');
    await expect(hints).toContainText('[3] ???');
    await expect(hints).toContainText('[4] ???');
  });

  test('pressing 2 does not switch weapon (rifle locked)', async ({ gamePage: page }) => {
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(200);
    await expect(page.locator(HUD.weaponName)).toHaveText('Pistol');
  });

  test('pressing 3 does not switch weapon (uzi locked)', async ({ gamePage: page }) => {
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(200);
    await expect(page.locator(HUD.weaponName)).toHaveText('Pistol');
  });

  test('pressing 4 does not switch weapon (shotgun locked)', async ({ gamePage: page }) => {
    await page.keyboard.press('Digit4');
    await page.waitForTimeout(200);
    await expect(page.locator(HUD.weaponName)).toHaveText('Pistol');
  });

  test('pressing 1 stays on pistol', async ({ gamePage: page }) => {
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(200);
    await expect(page.locator(HUD.weaponName)).toHaveText('Pistol');
  });
});
