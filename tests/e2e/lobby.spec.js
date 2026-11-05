import { test, expect } from '@playwright/test';
import { createPlayers, createRoomAndJoin, pickSkinsAndStart, debug, tickOf } from './fixtures.js';

test('tworzenie pokoju, dołączanie po kodzie, wybór skinów, start meczu', async ({ browser }) => {
  const { pages, errors } = await createPlayers(browser, 3);
  const code = await createRoomAndJoin(pages);
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  await pickSkinsAndStart(pages, ['rycerz', 'lucznik', 'kaplan']);
  const d = await Promise.all(pages.map(debug));
  const hostIds = new Set(d.map((x) => x.hostId));
  expect(hostIds.size).toBe(1);
  expect(d.filter((x) => x.role === 'host')).toHaveLength(1);
  // host = najlepsze urządzenie (P1 ma najwyższy score)
  expect(d[0].role).toBe('host');
  const state = await pages[2].evaluate(() => window.__korona.getState());
  expect(state.players.map((p) => p.skin).sort()).toEqual(['kaplan', 'lucznik', 'rycerz']);
  const t1 = await tickOf(pages[1]);
  await pages[1].waitForTimeout(1500);
  expect(await tickOf(pages[1])).toBeGreaterThan(t1);
  await expect.poll(async () => Object.values((await debug(pages[0])).links).filter((m) => m === 'webrtc').length, { timeout: 15000 }).toBe(2);
  expect(errors).toEqual([]);
});

test('fallback bez WebRTC: mecz działa przez przekaźnik transportu', async ({ browser }) => {
  const { pages, errors } = await createPlayers(browser, 2, { query: 'relay=1&bot=1' });
  await createRoomAndJoin(pages);
  await pickSkinsAndStart(pages, ['lotrzyk', 'inzynier']);
  const t1 = await tickOf(pages[1]);
  await pages[1].waitForTimeout(2000);
  expect(await tickOf(pages[1])).toBeGreaterThan(t1 + 10);
  expect((await debug(pages[0])).links).toEqual({});
  // klient porusza się (inputy dochodzą do hosta przez przekaźnik)
  const pos = () => pages[0].evaluate(() => window.__korona.getState().players.map((p) => [p.x, p.y]));
  const a = await pos();
  await pages[0].waitForTimeout(1500);
  expect(await pos()).not.toEqual(a);
  expect(errors).toEqual([]);
});

test('rewanż w tym samym pokoju', async ({ browser }) => {
  const { pages, errors } = await createPlayers(browser, 2, { query: 'bot=1&speed=8' });
  await createRoomAndJoin(pages);
  await pickSkinsAndStart(pages, ['rycerz', 'kaplan']);
  for (const p of pages) await p.waitForSelector('#screen-summary:not(.hidden)', { timeout: 150_000 });
  await expect(pages[1].locator('#btn-rematch')).toBeDisabled();
  await pages[0].click('#btn-rematch');
  for (const p of pages) await p.waitForSelector('#screen-lobby:not(.hidden)');
  await pickSkinsAndStart(pages, ['lucznik', 'lotrzyk']);
  const st = await pages[1].evaluate(() => window.__korona.getState());
  expect(st.players.every((p) => p.score === 0)).toBe(true);
  expect(errors).toEqual([]);
});
