import { test, expect } from '@playwright/test';

async function openModes(page) {
  await page.goto('/?transport=local&speed=8');
  await page.click('#btn-local');
  await page.waitForSelector('#screen-modes:not(.hidden)');
}

test('Przetrwanie: fale, przerwa z ulepszeniami, koniec z wynikiem fali', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openModes(page);
  await page.click('[data-mode="survival"]');
  await page.click('[data-map="wulkan"]');
  await page.click('[data-bots="3"]');
  await page.click('#btn-mode-start');
  await expect.poll(() => page.evaluate(() => window.__korona.getState().mapId)).toBe('wulkan');
  await expect.poll(() => page.evaluate(() => window.__korona.getState().modeData.wave), { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  // gracz stoi w miejscu — ginie; boty walczą dalej; czekamy na przerwę lub koniec
  await expect
    .poll(() => page.evaluate(() => { const s = window.__korona.getState(); return !!s.offers || s.phase === 'ended'; }), { timeout: 120_000 })
    .toBe(true);
  expect(errors).toEqual([]);
});

test('Boss Rush: skrzynka losuje bossa AI na wybranej mapie', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openModes(page);
  await page.click('[data-mode="bossrush"]');
  await page.click('[data-map="cmentarz"]');
  await page.click('[data-level="easy"]');
  await page.click('#btn-mode-start');
  await expect.poll(() => page.evaluate(() => window.__korona.getState().players.find((p) => p.ai)?.boss?.type ?? null), { timeout: 30_000 }).not.toBe(null);
  const st = await page.evaluate(() => window.__korona.getState());
  expect(st.mode).toBe('bossrush');
  expect(st.mapId).toBe('cmentarz');
  expect(st.aiLevel).toBe('easy');
  expect(errors).toEqual([]);
});

test('Klasyczny vs boty: losowa mapa, mecz startuje', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openModes(page);
  await page.click('[data-mode="crown"]');
  await page.click('[data-bots="5"]');
  await page.click('[data-level="hard"]');
  await page.click('#btn-mode-start');
  await expect.poll(() => page.evaluate(() => window.__korona.getState().phase), { timeout: 20_000 }).not.toBe('countdown');
  const st = await page.evaluate(() => window.__korona.getState());
  expect(st.players).toHaveLength(6);
  expect(st.mode).toBe('crown');
  expect(st.aiLevel).toBe('hard');
  expect(errors).toEqual([]);
});

test('Bitwa bossów: dwie drużyny po jednym bossie, rola gracza = boss', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openModes(page);
  await page.click('[data-mode="teams"]');
  await page.click('[data-tsize="3"]');
  await page.click('[data-role="boss"]');
  await page.click('#btn-mode-start');
  await expect.poll(() => page.evaluate(() => window.__korona?.getState?.()?.mode ?? null)).toBe('teams');
  const st = await page.evaluate(() => window.__korona.getState());
  expect(st.players).toHaveLength(6);
  expect(st.players.filter((p) => p.boss)).toHaveLength(2);
  expect(st.players[0].boss).toBeTruthy(); // gracz wybrał rolę bossa
  expect(new Set(st.players.filter((p) => p.boss).map((p) => p.team))).toEqual(new Set([0, 1]));
  expect(errors).toEqual([]);
});
