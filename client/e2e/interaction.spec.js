import { test, expect } from './fixtures/game.js';
import { HUD } from './helpers/selectors.js';

test.describe('Interaction system', () => {
  test('action container is hidden initially', async ({ gamePage: page }) => {
    const actionContainer = page.locator(HUD.actionContainer);
    await expect(actionContainer).toHaveCSS('display', 'none');
  });

  test('F key far from interactable does not show action bar', async ({ gamePage: page }) => {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    const actionContainer = page.locator(HUD.actionContainer);
    await expect(actionContainer).toHaveCSS('display', 'none');
  });

  test('stamina bar is visible and starts full', async ({ gamePage: page }) => {
    const staminaBar = page.locator(HUD.staminaBar);
    await expect(staminaBar).toBeVisible();
    await expect(staminaBar).toHaveCSS('width', /[1-9]/);
  });

  test('score starts at 0', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.score)).toHaveText('Score: 0');
  });

  test('kills start at 0', async ({ gamePage: page }) => {
    await expect(page.locator(HUD.kills)).toHaveText('Kills: 0');
  });
});
