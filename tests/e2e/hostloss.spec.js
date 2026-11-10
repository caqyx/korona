import { test, expect } from '@playwright/test';
import { createPlayers, createRoomAndJoin, pickSkinsAndStart, debug, closePlayersAfterEach } from './fixtures.js';

closePlayersAfterEach(test);

test('mecz 1 na 1: host wychodzi — pozostały gracz dostaje podsumowanie (walkower), nie zawiesza się', async ({ browser }) => {
  const { pages, errors } = await createPlayers(browser, 2, { query: 'bot=1', scores: [900, 500] });
  const [hostPage, p2] = pages;
  await createRoomAndJoin(pages);
  await pickSkinsAndStart(pages, ['rycerz', 'kaplan']);
  await p2.waitForTimeout(5000);
  expect((await debug(p2)).role).toBe('client');

  await hostPage.close();

  await p2.waitForSelector('#screen-summary:not(.hidden)', { timeout: 20_000 });
  const st = await p2.evaluate(() => window.__korona.getState());
  expect(st.phase).toBe('ended');
  expect(st.endReason).toBe('forfeit');
  expect(st.winnerId).toBe((await debug(p2)).selfId);
  expect((await debug(p2)).overlay).toBe(null);
  expect(errors.filter((e) => e.startsWith('P2'))).toEqual([]);
});
