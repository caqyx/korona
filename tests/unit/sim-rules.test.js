import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { spawnPoint } from '../../src/sim/state.js';
import { promoteToBoss, drawBossType, bindRng } from '../../src/sim/rules.js';
import { hurtBoss, hurtHero, feverMultiplier } from '../../src/sim/combat.js';
import { makeRng } from '../../src/sim/rng.js';
import { DT, MATCH, SCORE, BOSS_COMMON, BOSSES, BOSS_IDS, FEVER } from '../../src/sim/config.js';
import { makeMatch, bossArena, run, inp, BTN } from './sim-helpers.js';

const isSpawnPoint = (x, y) => Array.from({ length: MATCH.spawnCount }, (_, i) => spawnPoint(i)).some(([sx, sy]) => Math.abs(sx - x) < 1e-6 && Math.abs(sy - y) < 1e-6);

/** Kroki aż do końca przejścia; zwraca liczbę kroków. */
function finishTransition(state) {
  let n = 0;
  while (state.phase === 'transition' && n < 1000) {
    step(state, {});
    n++;
  }
  return n;
}

/** Bezpośrednie hurtBoss poza step() wymaga zbindowanego RNG (ostatni cios startuje przejście). */
function withRng(state, fn) {
  bindRng(makeRng(state.rng));
  try {
    return fn();
  } finally {
    bindRng(null);
  }
}

describe('crown pickup at center', () => {
  it('starts a transition without bonus and without +10', () => {
    const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }]);
    const a = state.players[0];
    a.x = 0.5;
    a.y = 0;
    step(state, {});
    expect(state.phase).toBe('transition');
    expect(state.transition.bonus).toBe(false);
    expect(state.transition.newBossId).toBe('A');
    expect(state.transition.prevBossId).toBe(null);
    expect(state.crown.state).toBe('held');
    expect(state.events.some((e) => e.t === 'crownTaken' && e.id === 'A' && e.bonus === false)).toBe(true);
    expect(a.score).toBe(0);
    expect(a.lastHits).toBe(0);
    expect(a.boss).toBe(null);
  });

  it('transition lasts 1.5 s real time at 0.3 world speed, then the player becomes boss with full HP', () => {
    const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }]);
    const a = state.players[0];
    a.x = 0.5;
    a.y = 0;
    step(state, {});
    const t0 = state.time;
    step(state, {});
    expect(state.time - t0).toBeCloseTo(DT * MATCH.slowmoScale, 12);
    const n = 1 + finishTransition(state);
    expect(n * DT).toBeGreaterThanOrEqual(MATCH.transitionTime - 1e-9);
    expect(n * DT).toBeLessThanOrEqual(MATCH.transitionTime + DT + 1e-9);
    expect(state.phase).toBe('playing');
    expect(a.boss).not.toBe(null);
    const type = a.boss.type;
    expect(BOSS_IDS).toContain(type);
    expect(a.boss.maxHp).toBe(Math.round(BOSS_COMMON.hpPerHero * 2 * BOSSES[type].hpMul));
    expect(a.boss.hp).toBe(a.boss.maxHp);
    expect(state.lastBossType).toBe(type);
    expect(a.score).toBe(0);
  });

  it('boss maxHp = 120 x heroes x hpMul for every type', () => {
    for (const type of BOSS_IDS) {
      const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }]);
      promoteToBoss(state, state.players[0], type);
      expect(state.players[0].boss.maxHp).toBe(Math.round(120 * 4 * BOSSES[type].hpMul));
    }
  });
});

describe('boss kill / crown takeover', () => {
  it('hero X with last hit gets +10, lastHits+1, becomes boss; previous boss respawns as hero with 2 s invuln', () => {
    const { state, boss, heroes } = bossArena('burza', [
      { id: 'X', skin: 'rycerz', x: -1.7, y: 0 },
      { id: 'Y', x: 0, y: 10 },
    ]);
    const x = heroes[0];
    boss.boss.hp = 5;
    const scoreBefore = x.score;
    step(state, { X: inp({ aimX: 0, aimY: 0, buttons: BTN.ATTACK }) });
    expect(state.phase).toBe('transition');
    expect(state.transition.bonus).toBe(true);
    expect(state.transition.newBossId).toBe('X');
    expect(state.transition.prevBossId).toBe('B');
    expect(state.transition.bossType).not.toBe('burza');
    expect(x.score).toBe(scoreBefore + SCORE.lastHit);
    expect(x.lastHits).toBe(1);
    expect(state.events.some((e) => e.t === 'lastHit' && e.id === 'X')).toBe(true);

    finishTransition(state);
    expect(state.phase).toBe('playing');
    expect(x.boss).not.toBe(null);
    expect(x.boss.type).not.toBe('burza');
    expect(x.boss.hp).toBe(x.boss.maxHp);
    expect(boss.boss).toBe(null);
    expect(boss.alive).toBe(true);
    expect(boss.hp).toBe(3);
    expect(boss.invulnT).toBeCloseTo(2, 9);
    expect(isSpawnPoint(boss.x, boss.y)).toBe(true);
    expect(state.crown.holderId).toBe('X');
  });

  it('assist: >=25% of boss maxHp without last hit gets +2, below threshold gets nothing', () => {
    const { state, boss, heroes } = bossArena('burza', [
      { id: 'X', skin: 'rycerz', x: -1.7, y: 0 },
      { id: 'A', x: 0, y: 10 },
      { id: 'L', x: 10, y: 3 },
      { id: 'T', x: -10, y: 3 },
    ]);
    const [, a, low, exact] = heroes;
    const max = boss.boss.maxHp; // 120 * 4
    expect(max).toBe(480);
    withRng(state, () => {
      hurtBoss(state, boss, 0.3 * max, 'A');
      hurtBoss(state, boss, 0.25 * max - 1, 'L');
      hurtBoss(state, boss, 0.25 * max, 'T');
    });
    boss.boss.hp = 5;
    step(state, { X: inp({ buttons: BTN.ATTACK }) });
    expect(state.phase).toBe('transition');
    expect(a.score).toBe(SCORE.assist);
    expect(exact.score).toBe(SCORE.assist);
    expect(low.score).toBe(0);
    expect(heroes[0].score).toBe(SCORE.lastHit);
    expect(state.events.filter((e) => e.t === 'assist').map((e) => e.id).sort()).toEqual(['A', 'T']);
  });
});

describe('scoring', () => {
  it('+perCrownSecond for every crownInterval seconds in the crown', () => {
    const { state, boss } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    const iv = Math.round(SCORE.crownInterval * 60);
    run(state, iv - 1);
    expect(boss.score).toBe(0);
    run(state, 2);
    expect(boss.score).toBe(SCORE.perCrownSecond);
    run(state, 9 * iv);
    expect(boss.score).toBe(10 * SCORE.perCrownSecond);
    expect(boss.crownTime).toBeCloseTo((10 * iv + 1) * DT, 9);
  });

  it('+3 for the boss killing a hero', () => {
    const { state, boss, heroes } = bossArena('kolos', [{ id: 'H', x: 3, y: 0 }]);
    const h = heroes[0];
    h.hp = 1;
    expect(hurtHero(state, h, 1, 'B', 0, 0)).toBe(true);
    expect(h.alive).toBe(false);
    expect(boss.score).toBe(SCORE.bossKillsHero);
    expect(boss.bossKills).toBe(1);
    expect(h.deaths).toBe(1);
  });

  it('reaching targetScore ends the match with winnerId', () => {
    const { state, boss } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    expect(state.targetScore).toBe(100);
    boss.score = 99;
    boss.crownAcc = SCORE.crownInterval - DT / 2;
    step(state, {});
    expect(boss.score).toBe(100);
    expect(state.phase).toBe('ended');
    expect(state.winnerId).toBe('B');
    expect(state.endReason).toBe('score');
    const tick = state.tick;
    const snapshot = JSON.stringify({ ...state, tick: 0, events: [] });
    step(state, {});
    expect(state.tick).toBe(tick + 1);
    expect(JSON.stringify({ ...state, tick: 0, events: [] })).toBe(snapshot);
  });

  it('time limit -> leader wins', () => {
    const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }], { timeLimit: 1 });
    state.players[1].score = 7;
    state.players[2].score = 3;
    run(state, 59);
    expect(state.phase).toBe('playing');
    run(state, 2);
    expect(state.phase).toBe('ended');
    expect(state.endReason).toBe('time');
    expect(state.winnerId).toBe('B');
  });

  it('default time limit is 8 minutes', () => {
    expect(makeMatch([{ id: 'A' }, { id: 'B' }]).timeLimit).toBe(480);
  });
});

describe('fever', () => {
  it('feverMultiplier curve', () => {
    expect(feverMultiplier(0)).toBe(1);
    expect(feverMultiplier(39.99)).toBe(1);
    expect(feverMultiplier(40)).toBeCloseTo(1.1, 9);
    expect(feverMultiplier(49.99)).toBeCloseTo(1.1, 9);
    expect(feverMultiplier(50)).toBeCloseTo(1.2, 9);
    expect(feverMultiplier(60)).toBeCloseTo(1.3, 9);
    expect(feverMultiplier(70)).toBeCloseTo(1.4, 9);
    expect(feverMultiplier(80)).toBeCloseTo(1.5, 9);
    expect(feverMultiplier(200)).toBeCloseTo(1 + FEVER.max, 9);
    expect(feverMultiplier(10000)).toBeCloseTo(1.5, 9);
  });

  it('hurtBoss applies fever multiplier', () => {
    const { state, boss } = bossArena('burza', [{ id: 'H', x: 0, y: 12 }]);
    boss.boss.reign = 0;
    hurtBoss(state, boss, 10, 'H');
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(10, 9);
    const hp1 = boss.boss.hp;
    boss.boss.reign = 60;
    hurtBoss(state, boss, 10, 'H');
    expect(hp1 - boss.boss.hp).toBeCloseTo(13, 9);
    expect(state.players[1].dmgToBoss).toBeCloseTo(23, 9);
    const hp2 = boss.boss.hp;
    boss.boss.reign = 500;
    hurtBoss(state, boss, 10, 'H');
    expect(hp2 - boss.boss.hp).toBeCloseTo(15, 9);
  });

  it('fever stacks with Kolos damage reduction', () => {
    const { state, boss } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    boss.boss.reign = 45;
    hurtBoss(state, boss, 100, 'H');
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(100 * 0.85 * 1.1, 9);
  });

  it('reign accrues while in the crown so fever kicks in during play', () => {
    const { state, boss } = bossArena('burza', [{ id: 'H', x: 0, y: 12 }]);
    run(state, 40 * 60 + 1);
    expect(boss.boss.reign).toBeGreaterThanOrEqual(40);
    expect(feverMultiplier(boss.boss.reign)).toBeCloseTo(1.1, 9);
  });
});

describe('drawBossType', () => {
  it('never repeats the previous type and covers all 3 others', () => {
    for (const last of BOSS_IDS) {
      const rng = makeRng({ s: 1000 + last.length });
      const seen = new Set();
      for (let i = 0; i < 1000; i++) {
        const { type, choices } = drawBossType(rng, last);
        expect(type).not.toBe(last);
        expect(choices).toHaveLength(3);
        expect(choices).not.toContain(last);
        expect(choices).toContain(type);
        seen.add(type);
      }
      expect([...seen].sort()).toEqual(BOSS_IDS.filter((t) => t !== last).sort());
    }
  });

  it('chained draws (last = previous result) never repeat', () => {
    const rng = makeRng({ s: 7 });
    let last = null;
    for (let i = 0; i < 1000; i++) {
      const { type, choices } = drawBossType(rng, last);
      expect(type).not.toBe(last);
      expect(choices).toContain(type);
      expect(new Set(choices).size).toBe(choices.length);
      last = type;
    }
  });
});
