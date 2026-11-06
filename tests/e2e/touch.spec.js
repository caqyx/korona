import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7 landscape'] });

test('dotyk: celowanie przeciąganiem (bez auto-aim) — Meteor spada w wycelowany punkt', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?transport=local');
  await page.click('#btn-local');
  await page.click('[data-mode="crown"]');
  await page.click('#mode-root [data-skin="mag"]');
  await page.selectOption('#mode-device', 'touch');
  await page.click('[data-bots="1"]');
  await page.click('#btn-mode-start');
  await page.waitForFunction(() => window.__korona.getState().phase === 'playing', null, { timeout: 15000 });
  const box = await page.locator('.tb[data-b="ability"]').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy, { steps: 6 }); // przeciągnięcie w lewo
  const me = await page.evaluate(() => {
    const p = window.__korona.getState().players[0];
    return { x: p.x, y: p.y, cd: p.abilCd };
  });
  expect(me.cd).toBe(0); // przytrzymanie jeszcze nie rzuca
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__korona.getState().zones.find((z) => z.kind === 'meteorHero') ?? null)).not.toBe(null);
  const z = await page.evaluate(() => window.__korona.getState().zones.find((z) => z.kind === 'meteorHero'));
  expect(z.x).toBeLessThan(me.x - 2); // poleciał w lewo, tam gdzie przeciągnięto
  expect(Math.abs(z.y - me.y)).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});
