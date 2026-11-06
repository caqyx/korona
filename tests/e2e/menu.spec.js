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

test('Customize: wygląd — darmowa czapka zapisuje się, zablokowany kolor nie, odblokowanie osiągnięciem', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?transport=local');
  const look = () => page.evaluate(() => JSON.parse(localStorage.getItem('korona.profile') || '{}').look);
  await page.click('#btn-customize');
  await page.click('.look-tab[data-tab="hat"]');
  await page.click('.look-tile[data-kind="hat"][data-id="party"]');
  await expect(page.locator('.look-tile[data-kind="hat"][data-id="party"]')).toHaveClass(/sel/);
  expect((await look()).hat).toBe('party');

  // zablokowany kolor (nagroda za „Pierwsza krew”) — nie da się wybrać, pokazuje osiągnięcie
  await page.click('.look-tab[data-tab="color"]');
  const copper = page.locator('.look-tile[data-kind="color"][data-id="copper"]');
  await expect(copper).toHaveClass(/locked/);
  await copper.click();
  await expect(page.locator('#look-info')).toContainText('Pierwsza krew');
  expect((await look()).color).toBe('default');
  // skin innej klasy (Złoty Rycerz dla Rycerza) jest zablokowany dla Maga
  await page.click('.modal [data-class="mag"]');
  await expect(page.locator('.look-tile[data-kind="color"][data-id="gold_knight"]')).toContainText('Tylko: Rycerz');

  // czapka przetrwała przeładowanie
  await page.reload();
  expect((await look()).hat).toBe('party');

  // odblokowanie: 1 rozegrany mecz → Miedziany dostępny
  await page.evaluate(() => localStorage.setItem('korona.stats', JSON.stringify({ matches: 1 })));
  await page.reload();
  await page.click('#btn-customize');
  await page.click('.look-tab[data-tab="color"]');
  await expect(copper).not.toHaveClass(/locked/);
  await copper.click();
  await expect(copper).toHaveClass(/sel/);
  expect((await look()).color).toBe('copper');

  // Osiągnięcia: nagroda odblokowana z przyciskiem „Załóż”
  await page.click('.modal [data-close]');
  await page.click('#btn-ach');
  await expect(page.locator('#ach-list [data-wear="color:copper"]')).toBeVisible();
  expect(errors).toEqual([]);
});
