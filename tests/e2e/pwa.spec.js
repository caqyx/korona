import { test, expect } from '@playwright/test';

test('PWA: manifest, brak błędów instalowalności, tryb lokalny działa offline', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return href ? (await fetch(href)).json() : null;
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('landscape');
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  // Service Worker gotowy i kontroluje stronę
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Chrome: lista błędów instalowalności (to samo, co sprawdza Lighthouse PWA)
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);

  // offline: przeładowanie z cache i gra lokalna botów
  await ctx.setOffline(true);
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.reload();
  // czcionka interfejsu jest w precache: offline wczytuje się z cache, żadne żądanie startowe nie pada
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Pixelify Sans"'))).toBe(true);
  expect(failed).toEqual([]);
  await page.click('#btn-local');
  await page.click('#btn-mode-custom');
  await page.selectOption('select[data-i="0"][data-k="device"]', 'bot');
  await page.click('#btn-local-start');
  await expect.poll(() => page.evaluate(() => window.__korona.getState().phase), { timeout: 10000 }).toBe('playing');
  const t = await page.evaluate(() => window.__korona.getState().tick);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__korona.getState().tick)).toBeGreaterThan(t);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('PWA: nowa wersja nie przejmuje otwartej aplikacji sama (bez wymuszonego przeładowania po starcie)', async ({ request }) => {
  // autoUpdate generował `self.skipWaiting()` na starcie SW i przeładowywał stronę kilka sekund po otwarciu;
  // teraz SW czeka na komunikat SKIP_WAITING (przycisk „Aktualizuj”) albo na następne uruchomienie
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('SKIP_WAITING');
  expect(sw).not.toMatch(/self\.skipWaiting\(\),/);
  expect(sw).toContain('.woff2');
});
