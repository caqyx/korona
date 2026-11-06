import { test, expect } from '@playwright/test';

test('menu: Customize zmienia klasę (panel + domyślny bohater), Osiągnięcia, Multiplayer pusty', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?transport=local');
  await expect(page.locator('#class-pv canvas')).toBeVisible();
  await page.click('#btn-customize');
  await page.click('.modal [data-class="druid"]');
  await expect(page.locator('#class-name')).toHaveText('Druid');
  await page.click('.modal [data-close]');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('korona.profile')).skin)).toBe('druid');

  await page.click('#btn-ach');
  await page.waitForSelector('#screen-ach:not(.hidden)');
  await expect(page.locator('#ach-list .ach')).toHaveCount(16);
  await expect(page.locator('#ach-sum')).toContainText('0/16');
  await page.click('#btn-ach-back');

  await page.click('#btn-multi');
  await page.waitForSelector('#screen-multi:not(.hidden)');
  await expect(page.locator('#rooms-empty')).toBeVisible();
  await expect(page.locator('#btn-join-sel')).toBeDisabled();
  await page.click('#btn-multi-back');

  await page.click('#btn-local');
  await page.waitForSelector('#screen-modes:not(.hidden)');
  await expect(page.locator('#mode-root [data-skin="druid"]')).toHaveClass(/sel/);
  expect(errors).toEqual([]);
});
