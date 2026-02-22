import { test as base } from '@playwright/test';
import { AUTH, MENU, HUD } from '../helpers/selectors.js';

/**
 * menuPage – guest-login → land on main menu.
 * gamePage – guest-login → create room → land in-game with HUD visible.
 */
export const test = base.extend({
  menuPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForSelector(AUTH.guest, { timeout: 15_000 });
    await page.click(AUTH.guest);
    await page.waitForSelector(MENU.create, { timeout: 15_000 });
    await use(page);
  },

  gamePage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForSelector(AUTH.guest, { timeout: 15_000 });
    await page.click(AUTH.guest);
    await page.waitForSelector(MENU.create, { timeout: 15_000 });
    await page.click(MENU.create);
    await page.waitForSelector(HUD.hpBar, { timeout: 20_000 });
    await use(page);
  },
});

export { expect } from '@playwright/test';
