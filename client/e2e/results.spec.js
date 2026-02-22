import { test, expect } from '@playwright/test';

test.describe('Results screen', () => {
  const mockData = {
    wave: 5,
    elapsed: 185,
    scores: [
      { name: 'Alice', score: 1200, kills: 30, deaths: 2, accuracy: 65, extracted: true },
      { name: 'Bob', score: 0, kills: 10, deaths: 5, accuracy: 40, extracted: false },
    ],
  };

  test('renders results with extraction status', async ({ page }) => {
    await page.goto('/');

    // Inject ResultsScreen via dynamic import in the browser context
    await page.evaluate(async (data) => {
      const { ResultsScreen } = await import('/ui/ResultsScreen.js');
      const container = document.getElementById('game-container') || document.body;
      new ResultsScreen(container, data, () => {});
    }, mockData);

    // Verify the results overlay rendered
    await expect(page.locator('text=GAME OVER')).toBeVisible();
    await expect(page.locator('text=Wave 5')).toBeVisible();
    await expect(page.locator('text=3:05')).toBeVisible();

    // Check extraction statuses
    await expect(page.getByRole('cell', { name: 'Extracted', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Lost', exact: true })).toBeVisible();
    await expect(page.locator('text=NOT EXTRACTED')).toBeVisible();
  });

  test('shows player names and scores', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(async (data) => {
      const { ResultsScreen } = await import('/ui/ResultsScreen.js');
      const container = document.getElementById('game-container') || document.body;
      new ResultsScreen(container, data, () => {});
    }, mockData);

    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();
    await expect(page.locator('text=1200')).toBeVisible();
  });
});
