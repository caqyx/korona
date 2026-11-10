import { test, expect } from '@playwright/test';

/** Telefon poziomo (bez zmiany typu przeglądarki, więc można użyć w describe). */
const PHONE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };

/** Start meczu lokalnego (Klasyczny vs 1 bot) i czekanie na fazę gry. */
async function startLocalMatch(page, query = 'transport=local') {
  await page.goto(`/?${query}`);
  await page.click('#btn-local');
  await page.waitForSelector('#screen-modes:not(.hidden)');
  await page.click('[data-mode="crown"]');
  await page.click('[data-bots="1"]');
  await page.click('#btn-mode-start');
  await page.waitForFunction(() => window.__korona?.getState?.().phase === 'playing', null, { timeout: 15000 });
}

const matchTime = (page) => page.evaluate(() => window.__korona.getState().matchTime);

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('pauza: Esc zatrzymuje mecz lokalny, „Wznów” i Esc go wznawiają', async ({ page }) => {
  const errors = collectErrors(page);
  await startLocalMatch(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#match-menu')).toBeVisible();
  await expect(page.locator('#match-menu')).toContainText('Pauza');
  expect(await page.evaluate(() => window.__korona.isPaused())).toBe(true);
  const t1 = await matchTime(page);
  await page.waitForTimeout(700);
  expect(await matchTime(page)).toBe(t1); // czas meczu stoi

  await page.click('#match-menu [data-act="resume"]');
  await expect(page.locator('#match-menu')).toHaveCount(0);
  await expect.poll(() => matchTime(page)).toBeGreaterThan(t1 + 0.3);

  // Esc przełącza w obie strony
  await page.keyboard.press('Escape');
  await expect(page.locator('#match-menu')).toBeVisible();
  const t2 = await matchTime(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#match-menu')).toHaveCount(0);
  await expect.poll(() => matchTime(page)).toBeGreaterThan(t2 + 0.3);
  expect(errors).toEqual([]);
});

test('pauza: „Sterowanie” otwiera ustawienia nad menu, Esc zamyka najpierw ustawienia', async ({ page }) => {
  const errors = collectErrors(page);
  await startLocalMatch(page);
  await page.keyboard.press('Escape');
  await page.click('#match-menu [data-act="controls"]');
  await expect(page.locator('.modal-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-settings')).toHaveCount(0);
  await expect(page.locator('#match-menu')).toBeVisible(); // nadal pauza
  expect(await page.evaluate(() => window.__korona.isPaused())).toBe(true);
  expect(errors).toEqual([]);
});

test('pauza: „Wyjdź do menu” wraca na start i podsumowanie już się nie pojawia', async ({ page }) => {
  const errors = collectErrors(page);
  // speed=8 + target=3: mecz kończy się po kilku sekundach, więc porzucony mecz „dobiegłby końca”, gdyby nie został zatrzymany
  await startLocalMatch(page, 'transport=local&speed=8&target=3');
  await page.keyboard.press('Escape');
  const t = await matchTime(page);
  await page.click('#match-menu [data-act="leave"]');
  await expect(page.locator('#screen-start')).toBeVisible();
  await expect(page.locator('#match-menu')).toHaveCount(0);
  await page.waitForTimeout(3500);
  await expect(page.locator('#screen-summary')).toBeHidden();
  await expect(page.locator('#screen-start')).toBeVisible();
  expect(await matchTime(page)).toBe(t); // symulacja porzuconego meczu stoi
  expect(errors).toEqual([]);
});

test('Esc po końcu meczu nie otwiera pauzy — ani w oknie przed podsumowaniem, ani na podsumowaniu', async ({ page }) => {
  const errors = collectErrors(page);
  await startLocalMatch(page, 'transport=local&speed=8&target=2');
  await page.waitForFunction(() => window.__korona.getState().phase === 'ended', null, { timeout: 60000 });
  await page.keyboard.press('Escape'); // w oknie 1,5 s przed podsumowaniem
  await expect(page.locator('#match-menu')).toBeHidden();
  await expect(page.locator('#screen-summary')).toBeVisible();
  await page.keyboard.press('Escape'); // na podsumowaniu
  await expect(page.locator('#match-menu')).toBeHidden();
  await expect(page.locator('#screen-summary')).toBeVisible();
  expect(errors).toEqual([]);
});

test('karta w tle: mecz lokalny pauzuje się sam', async ({ page }) => {
  const errors = collectErrors(page);
  await startLocalMatch(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#match-menu')).toBeVisible();
  expect(await page.evaluate(() => window.__korona.isPaused())).toBe(true);
  expect(errors).toEqual([]);
});

test.describe('dotyk', () => {
  test.use(PHONE);

  test('przycisk pauzy ma min. 44 px, pauzuje, a „Wyjdź do menu” chowa warstwę dotykową', async ({ page }) => {
    const errors = collectErrors(page);
    await startLocalMatch(page);
    const btn = page.locator('#touch [data-pause]');
    const box = await btn.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await btn.tap();
    await expect(page.locator('#match-menu')).toBeVisible();
    expect(await page.evaluate(() => window.__korona.isPaused())).toBe(true);
    await page.locator('#match-menu [data-act="leave"]').tap();
    await expect(page.locator('#screen-start')).toBeVisible();
    await expect(page.locator('#touch')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
