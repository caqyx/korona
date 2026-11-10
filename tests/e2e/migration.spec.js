import { test, expect } from '@playwright/test';
import { createPlayers, createRoomAndJoin, pickSkinsAndStart, debug, tickOf, scoresOf, closePlayersAfterEach } from './fixtures.js';

closePlayersAfterEach(test);

async function setupMatch(browser, query = 'bot=1') {
  // P1 najlepszy (host), P2 średni (następca), P3 najsłabszy
  const env = await createPlayers(browser, 3, { query, scores: [900, 500, 300] });
  await createRoomAndJoin(env.pages);
  await pickSkinsAndStart(env.pages, ['rycerz', 'lotrzyk', 'inzynier']);
  await env.pages[1].waitForTimeout(6000); // countdown + trochę gry, żeby były punkty
  return env;
}

test('zamknięcie karty hosta: gra trwa, nowy host zgodny z rankingiem, wynik zachowany', async ({ browser }) => {
  const { pages, errors } = await setupMatch(browser);
  const [hostPage, p2, p3] = pages;
  const before = await debug(p2);
  expect(before.hostId).toBe((await debug(hostPage)).selfId);
  const expectedSuccessor = before.ranking.filter((id) => id !== before.hostId)[0];
  expect(expectedSuccessor).toBe((await debug(p2)).selfId);
  const scoresBefore = await scoresOf(p3);
  const oldHostId = before.hostId;

  await hostPage.close();

  await expect.poll(async () => (await debug(p3)).hostId, { timeout: 15000 }).toBe(expectedSuccessor);
  await expect.poll(async () => (await debug(p2)).role, { timeout: 15000 }).toBe('host');
  expect((await debug(p2)).epoch).toBe(2);
  // odliczanie i wznowienie
  await expect.poll(async () => (await debug(p3)).overlay, { timeout: 15000 }).toBe(null);
  const t1 = await tickOf(p3);
  await p3.waitForTimeout(2000);
  expect(await tickOf(p3)).toBeGreaterThan(t1);
  const scoresAfter = await scoresOf(p3);
  for (const [id, s] of Object.entries(scoresBefore)) expect(scoresAfter[id]).toBeGreaterThanOrEqual(s);
  const st = await p3.evaluate(() => window.__korona.getState());
  const old = st.players.find((p) => p.id === oldHostId);
  expect(old.dnf).toBe(true);
  expect(errors.filter((e) => !e.startsWith('P1'))).toEqual([]);
});

test('ukrycie karty hosta: migracja planowana do następcy', async ({ browser }) => {
  const { pages, errors } = await setupMatch(browser);
  const [hostPage, p2, p3] = pages;
  const succ = (await debug(p2)).selfId;
  const scoresBefore = await scoresOf(p3);
  await hostPage.evaluate(() => {
    window.__koronaHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await debug(p2)).role, { timeout: 10000 }).toBe('host');
  await expect.poll(async () => (await debug(hostPage)).role, { timeout: 10000 }).toBe('client');
  await expect.poll(async () => (await debug(p3)).hostId, { timeout: 10000 }).toBe(succ);
  expect((await debug(hostPage)).hostId).toBe(succ);
  expect((await debug(hostPage)).log.some((l) => l.includes('planned handoff (hidden)'))).toBe(true);
  await expect.poll(async () => (await debug(p3)).overlay, { timeout: 10000 }).toBe(null);
  const t1 = await tickOf(hostPage);
  await p3.waitForTimeout(2000);
  expect(await tickOf(hostPage)).toBeGreaterThan(t1);
  const st = await p3.evaluate(() => window.__korona.getState());
  expect(st.players.every((p) => p.connected)).toBe(true);
  const scoresAfter = await scoresOf(p3);
  for (const [id, s] of Object.entries(scoresBefore)) expect(scoresAfter[id]).toBeGreaterThanOrEqual(s);
  expect(errors).toEqual([]);
});
