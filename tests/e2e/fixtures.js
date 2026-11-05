/**
 * Pomocnicze funkcje E2E: 3 osobne konteksty przeglądarki połączone mostem dla LocalTransport.
 * BroadcastChannel nie działa między kontekstami, więc most (exposeBinding) przekazuje
 * wiadomości kanału do pozostałych stron — sama logika aplikacji pozostaje bez zmian.
 */
export async function createPlayers(browser, n, { query = '', scores = [] } = {}) {
  const pages = [];
  const errors = [];
  const contexts = [];
  for (let i = 0; i < n; i++) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
    contexts.push(ctx);
    const page = await ctx.newPage();
    page.__name = `P${i + 1}`;
    page.on('pageerror', (e) => errors.push(`${page.__name} pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${page.__name} console: ${m.text()}`);
    });
    await ctx.exposeBinding('__koronaBridgeSend', (_src, key, data) => {
      for (const other of pages) {
        if (other === page || other.isClosed()) continue;
        other.evaluate(([k, d]) => window.__koronaBridgeReceive?.(k, d), [key, data]).catch(() => {});
      }
    });
    pages.push(page);
    const score = scores[i] ?? 1000 - i * 100;
    await page.goto(`/?transport=local&ice=none&score=${score}${query ? '&' + query : ''}`);
    await page.fill('#nick', `Gracz${i + 1}`);
  }
  return { pages, errors, contexts };
}

export async function createRoomAndJoin(pages) {
  const [owner, ...rest] = pages;
  await owner.click('#btn-create');
  await owner.waitForSelector('#screen-lobby:not(.hidden)');
  const code = (await owner.textContent('#room-code')).trim();
  for (const p of rest) {
    await p.fill('#join-code', code);
    await p.click('#btn-join');
    await p.waitForSelector('#screen-lobby:not(.hidden)');
  }
  await owner.waitForFunction((n) => document.querySelectorAll('#lobby-players li').length === n, pages.length);
  return code;
}

export async function pickSkinsAndStart(pages, skins) {
  for (let i = 0; i < pages.length; i++) {
    await pages[i].click(`.skin[data-skin="${skins[i]}"]`);
    await pages[i].click('#btn-ready');
  }
  await pages[0].waitForFunction(() => !document.querySelector('#btn-start').disabled);
  await pages[0].click('#btn-start');
  for (const p of pages) await p.waitForFunction(() => window.__korona?.debug?.().phase === 'match' && !!window.__korona.getState());
}

export const debug = (page) => page.evaluate(() => window.__korona.debug());
export const tickOf = (page) => page.evaluate(() => window.__korona.getState()?.tick ?? -1);
export const scoresOf = (page) => page.evaluate(() => Object.fromEntries(window.__korona.getState().players.map((p) => [p.id, p.score])));
