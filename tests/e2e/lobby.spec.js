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
