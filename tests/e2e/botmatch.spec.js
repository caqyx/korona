import { test, expect } from '@playwright/test';
import { createPlayers, createRoomAndJoin, pickSkinsAndStart } from './fixtures.js';

test('mecz botów kończy się zwycięzcą przy 100 pkt bez błędów w konsoli', async ({ browser }) => {
  test.setTimeout(240_000);
  // speed=8: host przyspiesza czas symulacji (debug), cel pozostaje 100 pkt
  const { pages, errors } = await createPlayers(browser, 3, { query: 'bot=1&speed=8' });
  await createRoomAndJoin(pages);
  await pickSkinsAndStart(pages, ['lucznik', 'kaplan', 'inzynier']);
  for (const p of pages) await p.waitForSelector('#screen-summary:not(.hidden)', { timeout: 200_000 });
  const finals = await Promise.all(pages.map((p) => p.evaluate(() => window.__korona.getState())));
  for (const s of finals) {
    expect(s.phase).toBe('ended');
    expect(s.winnerId).toBeTruthy();
    expect(s.endReason).toBe('score');
    const w = s.players.find((p) => p.id === s.winnerId);
    expect(w.score).toBeGreaterThanOrEqual(100);
  }
  expect(new Set(finals.map((s) => s.winnerId)).size).toBe(1);
  await expect(pages[1].locator('#summary-title')).toContainText('Wygrywa');
  expect(errors).toEqual([]);
});
