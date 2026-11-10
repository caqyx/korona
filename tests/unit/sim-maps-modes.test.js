import { describe, it, expect } from 'vitest';
import { createMatchState } from '../../src/sim/state.js';
import { step } from '../../src/sim/step.js';
import { botInput } from '../../src/sim/bot.js';
import { makeRng } from '../../src/sim/rng.js';
import { MAPS, MAP_IDS, getMap, inHazard, pickMapId, HAZARD } from '../../src/sim/maps.js';
import { mapSpawnPoint, bindMap, resolveStatic, outsideArena } from '../../src/sim/physics.js';
import { MINIONS, MODES, UPGRADE_IDS, HERO, BOSS_COMMON, BOSSES } from '../../src/sim/config.js';
import { buildWave, applyUpgradeEffect } from '../../src/sim/modes.js';
import { BTN } from '../../src/sim/state.js';

const players = (n, skins = ['rycerz', 'lucznik', 'kaplan', 'inzynier', 'lotrzyk']) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `p${i}`, skin: skins[i % skins.length] }));
const inp = (o = {}) => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0, ...o });

describe('mapy', () => {
  it('każda mapa ma wolny środek, przeszkody w arenie i poprawne spawny', () => {
    for (const id of MAP_IDS) {
      const m = getMap(id);
      expect(m.obstacles.every((o) => Math.hypot(o.x, o.y) > o.r + 1.5), id).toBe(true);
      bindMap(id);
      for (const o of m.obstacles) expect(outsideArena(o.x, o.y, o.r), `${id} obstacle`).toBe(false);
      for (let i = 0; i < 8; i++) {
        const [x, y] = mapSpawnPoint(i, id);
        expect(outsideArena(x, y, HERO.radius), `${id} spawn ${i}`).toBe(false);
        expect(m.obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + HERO.radius)).toBe(false);
        expect(m.hazards.some((z) => (z.kind === 'lava' || z.kind === 'quicksand') && inHazard(z, x, y))).toBe(false);
      }
      bindMap('arena');
    }
  });

  it('losowanie mapy jest deterministyczne i obejmuje wszystkie mapy', () => {
    const seen = new Set();
    for (let s = 0; s < 500; s++) {
      expect(pickMapId(s)).toBe(pickMapId(s));
      seen.add(pickMapId(s));
    }
    expect([...seen].sort()).toEqual([...MAP_IDS].sort());
  });

  it('prostokątna arena trzyma gracza w granicach', () => {
    bindMap('tundra');
    const e = { x: 100, y: -100 };
    resolveStatic(e, 0.4);
    expect(e.x).toBeCloseTo(MAPS.tundra.hw - 0.4, 6);
    expect(e.y).toBeCloseTo(-(MAPS.tundra.hh - 0.4), 6);
    bindMap('arena');
  });

  function onMap(mapId, x, y) {
    const st = createMatchState({ seed: 1, players: players(2), countdown: 0, mapId });
    st.phase = 'playing';
    st.players[0].x = x;
    st.players[0].y = y;
    st.players[0].invulnT = 0;
    // drugi gracz zostaje na spawnie (nie podnosi korony ze środka)
    st.crown.state = 'none';
    return st;
  }

  it('lawa zadaje 1 dmg co sekundę bohaterowi, dash nad lawą jest bezpieczny', () => {
    const z = MAPS.wulkan.hazards[0];
    const st = onMap('wulkan', z.x, z.y);
    for (let i = 0; i < 60; i++) step(st, {}); // pierwszy tick po 0,4 s, kolejne co 1 s
    expect(st.players[0].hp).toBe(st.players[0].maxHp - 1);
    const st2 = onMap('wulkan', z.x, z.y);
    st2.players[0].dashT = 10;
    for (let i = 0; i < 60; i++) step(st2, {});
    expect(st2.players[0].hp).toBe(st2.players[0].maxHp);
    expect(HAZARD.lava.dmg).toBe(1);
  });

  it('na lodzie postać się ślizga (bezwładność po puszczeniu ruchu)', () => {
    const st = onMap('tundra', -12.5, 0);
    for (let i = 0; i < 30; i++) step(st, { p0: inp({ moveY: 1 }) });
    const y0 = st.players[0].y;
    for (let i = 0; i < 10; i++) step(st, {});
    expect(st.players[0].y).toBeGreaterThan(y0 + 0.2);
    const off = onMap('arena', 0, 6);
    for (let i = 0; i < 30; i++) step(off, { p0: inp({ moveY: 1 }) });
    const y1 = off.players[0].y;
    for (let i = 0; i < 10; i++) step(off, {});
    expect(off.players[0].y).toBeCloseTo(y1, 6);
  });

  it('krzaki ukrywają bohatera, atak odsłania', () => {
    const b = MAPS.las.hazards[0];
    const st = onMap('las', b.x, b.y);
    step(st, {});
    expect(st.players[0].hidden).toBe(true);
    st.players[0].atkCd = 0;
    step(st, { p0: inp({ buttons: BTN.ATTACK, aimX: b.x + 1, aimY: b.y }) });
    step(st, {});
    expect(st.players[0].hidden).toBe(false);
  });

  it('ruchome piaski spowalniają i wciągają do środka', () => {
    const q = MAPS.pustynia.hazards[0];
    const st = onMap('pustynia', q.x + q.r * 0.8, q.y);
    const d0 = Math.hypot(st.players[0].x - q.x, st.players[0].y - q.y);
    for (let i = 0; i < 30; i++) step(st, {});
    expect(Math.hypot(st.players[0].x - q.x, st.players[0].y - q.y)).toBeLessThan(d0);
    expect(st.players[0].slowMul).toBeCloseTo(1 - HAZARD.quicksand.slow, 6);
  });

  it('cmentarz: ręce z grobów pojawiają się z telegrafem przed obrażeniami', () => {
    const st = onMap('cmentarz', 3, 3);
    const ev = MAPS.cmentarz.events[0];
    for (let i = 0; i < Math.round(ev.every * 60) + 1; i++) step(st, {});
    const hands = st.zones.filter((z) => z.kind === 'graveHand');
    expect(hands.length).toBe(ev.count);
    for (const z of hands) expect(z.warnTotal).toBeGreaterThanOrEqual(0.4);
  });
});

describe('tryby', () => {
  it('fale: budżet rośnie, typy odblokowują się z falami, co 5. fala boss', () => {
    const rng = makeRng({ s: 1 });
    const w1 = buildWave(1, 2, rng);
    const w4 = buildWave(4, 2, rng);
    expect(w1.queue.every((k) => MINIONS[k].minWave <= 1)).toBe(true);
    expect(w4.queue.length).toBeGreaterThan(w1.queue.length - 1);
    expect(buildWave(MODES.survival.bossEvery, 2, rng).bossWave).toBe(true);
    expect(buildWave(3, 2, rng).bossWave).toBe(false);
  });

  it('Przetrwanie: start fali, punkty za zabójstwa, przerwa z ofertą 3 ulepszeń, koniec gdy wszyscy zginą', () => {
    const st = createMatchState({ seed: 3, players: players(2), countdown: 0, mode: 'survival', mapId: 'arena' });
    expect(st.players.find((p) => p.ai)).toBeTruthy();
    const rngs = [makeRng({ s: 1 }), makeRng({ s: 2 })];
    let sawIntermission = false;
    let n = 0;
    while (st.phase !== 'ended' && n < 60 * 60 * 6) {
      step(st, { p0: botInput(st, 'p0', rngs[0], 'hard'), p1: botInput(st, 'p1', rngs[1], 'hard') });
      if (st.offers) {
        sawIntermission = true;
        for (const o of Object.values(st.offers)) {
          expect(o.choices).toHaveLength(3);
          expect(new Set(o.choices).size).toBe(3);
          expect(o.choices.every((c) => UPGRADE_IDS.includes(c))).toBe(true);
        }
      }
      n++;
    }
    expect(st.modeData.wave).toBeGreaterThanOrEqual(2);
    expect(sawIntermission).toBe(true);
    expect(st.players.filter((p) => !p.ai).some((p) => p.score > 0)).toBe(true);
    if (st.phase === 'ended') expect(st.endReason).toBe('wipe');
  }, 60_000);

  it('Boss Rush: AI-boss jest losowany skrzynką, kolejny jest silniejszy', () => {
    const st = createMatchState({ seed: 5, players: players(1), countdown: 0, mode: 'bossrush', mapId: 'arena' });
    for (let i = 0; i < 60 * 6; i++) step(st, {});
    const ai = st.players.find((p) => p.ai);
    expect(ai.boss).toBeTruthy();
    expect(ai.boss.maxHp).toBe(Math.round(BOSS_COMMON.hpPerHero * BOSSES[ai.boss.type].hpMul));
    // zabij bossa i przejdź do następnego
    const first = ai.boss.type;
    const firstMax = ai.boss.maxHp;
    ai.boss.hp = 1;
    st.players[0].x = ai.x - 2;
    st.players[0].y = ai.y;
    st.players[0].atkCd = 0;
    for (let i = 0; i < 30 && ai.boss; i++) step(st, { p0: inp({ buttons: BTN.ATTACK, aimX: ai.x, aimY: ai.y }) });
    expect(st.modeData.defeated).toBe(1);
    expect(st.offers).toBeTruthy();
    for (let i = 0; i < 60 * 20 && !ai.boss; i++) step(st, { p0: inp({ buttons: i % 2 ? BTN.ATTACK : 0 }) });
    expect(ai.boss).toBeTruthy();
    expect(ai.boss.type).not.toBe(first);
    expect(ai.boss.cdMul).toBeLessThan(1);
    expect(ai.boss.maxHp / firstMax).toBeGreaterThan(1.1);
  });

  it('ulepszenia zmieniają statystyki', () => {
    const h = { maxHp: 3, hp: 1, mods: { dmg: 1, cd: 1, spd: 1, dashCd: 1, range: 1 } };
    applyUpgradeEffect(h, 'vit');
    applyUpgradeEffect(h, 'dmg');
    applyUpgradeEffect(h, 'cd');
    expect(h.maxHp).toBe(4);
    expect(h.hp).toBe(4);
    expect(h.mods.dmg).toBeCloseTo(1.2, 6);
    expect(h.mods.cd).toBeCloseTo(0.85, 6);
  });

  it('Korona na każdej mapie kończy się zwycięzcą (boty)', () => {
    for (const mapId of MAP_IDS) {
      const st = createMatchState({ seed: 9, players: players(4), countdown: 0, mapId });
      const rngs = st.players.map((_, i) => makeRng({ s: i + 1 }));
      let n = 0;
      while (st.phase !== 'ended' && n < 60 * 60 * 9) {
        const inputs = {};
        st.players.forEach((p, i) => (inputs[p.id] = botInput(st, p.id, rngs[i])));
        step(st, inputs);
        n++;
      }
      expect(st.phase, mapId).toBe('ended');
      expect(st.winnerId, mapId).toBeTruthy();
    }
  }, 60_000);
});
