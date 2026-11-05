import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { hurtHero, hurtBoss } from '../../src/sim/combat.js';
import { BOSSES, BOSS_COMMON, HERO, DT } from '../../src/sim/config.js';
import { bossArena, inp, BTN } from './sim-helpers.js';

const BTN_OF = { atk: BTN.ATTACK, q: BTN.Q, e: BTN.E, r: BTN.R };

/**
 * Wciska umiejętność bossa i śledzi stan przez `steps` kroków.
 * Zwraca próbki per krok (indeks 0 = krok wciśnięcia).
 */
function castAndTrace(type, ab, { hero = { x: 4, y: 0 }, aim = hero, steps = 240, setup } = {}) {
  const { state, boss, heroes } = bossArena(type, [{ id: 'H', ...hero }]);
  const h = heroes[0];
  if (setup) setup(state, boss, h);
  const zonesBefore = new Set(state.zones.map((z) => z.id));
  step(state, { B: inp({ aimX: aim.x, aimY: aim.y, buttons: BTN_OF[ab] }) });
  const newZones = state.zones.filter((z) => !zonesBefore.has(z.id) && z.ownerId === 'B');
  const cast = boss.boss.cast ? { ...boss.boss.cast } : null;
  const cdAfterPress = boss.boss.cd[ab];
  const trace = [];
  const sample = () => ({
    hp: h.hp,
    hit: state.events.some((e) => e.t === 'heroHit' && e.id === 'H'),
    invisT: boss.boss.invisT,
    minions: state.minions.length,
    bx: boss.x,
    by: boss.y,
    hx: h.x,
    channel: boss.boss.channel ? boss.boss.channel.kind : null,
    bossHp: boss.boss.hp,
    events: state.events.slice(),
  });
  trace.push(sample());
  for (let i = 1; i < steps; i++) {
    step(state, {});
    trace.push(sample());
  }
  const firstDamage = trace.findIndex((s) => s.hit || s.hp < HERO.hp);
  return { state, boss, h, newZones, cast, cdAfterPress, trace, firstDamage };
}

/** [typ, umiejętność, czy zadaje obrażenia, opcje, dodatkowa weryfikacja] */
const CASES = [
  ['kolos', 'atk', true, { hero: { x: 2, y: 0 } }],
  ['kolos', 'q', true, { hero: { x: 4, y: 0 } }],
  [
    'kolos',
    'e',
    true,
    { hero: { x: 4, y: 0 } },
    (r) => {
      expect(r.trace.some((s) => s.channel === 'charge')).toBe(true);
      expect(r.h.stunT > 0 || r.trace.some((s) => s.hp < HERO.hp)).toBe(true);
    },
  ],
  ['kolos', 'r', true, { hero: { x: 4, y: 0 } }, (r) => expect(r.newZones.filter((z) => z.kind === 'boulder')).toHaveLength(BOSSES.kolos.r.count)],
  ['cien', 'atk', true, { hero: { x: 2, y: 0 } }],
  [
    'cien',
    'q',
    true,
    { hero: { x: 2, y: 0 }, aim: { x: -6, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].bx).toBeGreaterThan(-1);
      expect(r.boss.x).toBeCloseTo(-6, 1);
    },
  ],
  [
    'cien',
    'e',
    false,
    { hero: { x: 6, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].invisT).toBe(0);
      expect(r.trace[tg].invisT).toBeCloseTo(BOSSES.cien.e.duration, 6);
    },
  ],
  ['cien', 'r', true, { hero: { x: 5, y: 0 } }, (r, tg) => expect(r.trace[tg].events.filter((e) => e.t === 'bossFire').length).toBe(1)],
  ['nekromanta', 'atk', true, { hero: { x: 4, y: 0 } }],
  [
    'nekromanta',
    'q',
    false,
    { hero: { x: -10, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].minions).toBe(0);
      expect(r.trace[tg].minions).toBe(BOSSES.nekromanta.q.count);
    },
  ],
  ['nekromanta', 'e', true, { hero: { x: 4, y: 0 } }, (r) => expect(r.trace.some((s) => s.channel === 'drain')).toBe(true)],
  ['nekromanta', 'r', true, { hero: { x: 4, y: 0 } }],
  ['burza', 'atk', true, { hero: { x: 4, y: 0 } }],
  ['burza', 'q', true, { hero: { x: 4, y: 0 } }],
  [
    'burza',
    'e',
    false,
    { hero: { x: 4, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].hx).toBeCloseTo(4, 6);
      expect(r.trace.some((s) => s.channel === 'vortex')).toBe(true);
      expect(r.h.x).toBeLessThan(3);
    },
  ],
  ['burza', 'r', true, { hero: { x: 4, y: 0 } }, (r, tg) => expect(r.trace[tg].events.some((e) => e.t === 'chain')).toBe(true)],
  ['smok', 'atk', true, { hero: { x: 4, y: 0 } }],
  ['smok', 'q', true, { hero: { x: 4, y: 0 } }],
  [
    'smok',
    'e',
    true,
    { hero: { x: 6, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].bx).toBeLessThan(1);
      expect(r.trace[tg].bx).toBeGreaterThan(3);
    },
  ],
  ['smok', 'r', true, { hero: { x: 4, y: 0 } }, (r) => expect(r.newZones.filter((z) => z.kind === 'meteor')).toHaveLength(BOSSES.smok.r.count)],
  ['szron', 'atk', true, { hero: { x: 4, y: 0 } }],
  ['szron', 'q', true, { hero: { x: 3, y: 0 } }],
  ['szron', 'e', true, { hero: { x: 4, y: 0 } }],
  ['szron', 'r', true, { hero: { x: 4, y: 0 } }],
  ['pajeczyca', 'atk', true, { hero: { x: 2, y: 0 } }],
  [
    'pajeczyca',
    'q',
    false,
    { hero: { x: 4, y: 0 } },
    (r) => {
      expect(r.trace.some((s) => s.hit)).toBe(true);
      expect(r.h.hp).toBe(HERO.hp);
    },
  ],
  ['pajeczyca', 'e', true, { hero: { x: 5, y: 0 } }, (r) => expect(r.boss.x).toBeGreaterThan(2)],
  [
    'pajeczyca',
    'r',
    false,
    { hero: { x: -10, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].minions).toBe(0);
      expect(r.trace[tg].minions).toBe(BOSSES.pajeczyca.r.count);
    },
  ],
  ['widmo', 'atk', true, { hero: { x: 2, y: 0 } }],
  ['widmo', 'q', true, { hero: { x: 4, y: 0 } }],
  [
    'widmo',
    'e',
    false,
    { hero: { x: 3, y: 0 } },
    (r, tg) => {
      for (let i = 0; i < tg; i++) expect(r.trace[i].hx).toBeCloseTo(3, 6);
      expect(r.h.x).toBeGreaterThan(4);
      expect(r.h.hp).toBe(HERO.hp);
    },
  ],
  ['widmo', 'r', true, { hero: { x: 6, y: 0 } }],
];

describe('boss abilities: telegraph, delayed damage, cooldown', () => {
  for (const [type, ab, damages, opts, extra] of CASES) {
    it(`${type}.${ab}`, () => {
      const cfg = BOSSES[type][ab];
      const r = castAndTrace(type, ab, opts);
      const tg = Math.round(cfg.telegraph / DT);

      // telegraph created on press, within GDD bounds
      expect(cfg.telegraph).toBeGreaterThanOrEqual(0.4);
      expect(cfg.telegraph).toBeLessThanOrEqual(0.8);
      expect(r.cast).not.toBe(null);
      expect(r.cast.total).toBeCloseTo(cfg.telegraph, 9);
      expect(r.newZones.length).toBeGreaterThan(0);
      for (const z of r.newZones) {
        expect(z.warnTotal).toBeGreaterThanOrEqual(0.4);
        expect(z.warnTotal).toBeLessThanOrEqual(0.8);
        expect(z.warnTotal).toBeCloseTo(cfg.telegraph, 9);
      }

      // cooldown
      expect(r.cdAfterPress).toBeCloseTo(cfg.cd, 9);

      // no damage before the telegraph ends
      for (let i = 0; i < tg; i++) {
        expect(r.trace[i].hp, `hp at step ${i}`).toBe(HERO.hp);
        expect(r.trace[i].hit, `heroHit at step ${i}`).toBe(false);
      }
      if (damages) {
        expect(r.firstDamage, 'ability should damage the hero').toBeGreaterThanOrEqual(tg);
      }
      if (extra) extra(r, tg);
    });
  }

  it('cannot recast while on cooldown', () => {
    const { state, boss } = bossArena('burza', [{ id: 'H', x: 4, y: 0 }]);
    step(state, { B: inp({ aimX: 4, buttons: BTN.Q }) });
    for (let i = 0; i < 60; i++) step(state, {});
    const cd = boss.boss.cd.q;
    expect(cd).toBeGreaterThan(0);
    step(state, { B: inp({ aimX: 4, buttons: BTN.Q }) });
    expect(boss.boss.cast).toBe(null);
    expect(boss.boss.cd.q).toBeCloseTo(cd - DT, 9);
  });
});

describe('boss passives', () => {
  it('Widmo heals 6% max HP on hero kill', () => {
    const { state, boss, heroes } = bossArena('widmo', [{ id: 'H', x: 3, y: 0 }]);
    boss.boss.hp = boss.boss.maxHp / 2;
    heroes[0].hp = 1;
    hurtHero(state, heroes[0], 1, 'B', 0, 0);
    expect(boss.boss.hp).toBeCloseTo(boss.boss.maxHp * (0.5 + BOSSES.widmo.passive.healOnKill), 6);
  });

  it('Szron chills heroes it hits (slow 30% for 1.5 s)', () => {
    const { state, heroes } = bossArena('szron', [{ id: 'H', x: 3, y: 0 }]);
    hurtHero(state, heroes[0], 1, 'B', 0, 0);
    expect(heroes[0].slowT).toBeCloseTo(BOSSES.szron.passive.duration, 9);
    expect(heroes[0].slowMul).toBeCloseTo(1 - BOSSES.szron.passive.slow, 9);
  });

  it('Smok leaves a telegraphed burning patch every 4 s', () => {
    const { state } = bossArena('smok', [{ id: 'H', x: 0, y: 12 }]);
    for (let i = 0; i < Math.round(BOSSES.smok.passive.every / DT) + 2; i++) step(state, {});
    const ember = state.zones.find((z) => z.kind === 'embers');
    expect(ember).toBeTruthy();
    expect(ember.warnTotal).toBeGreaterThanOrEqual(0.4);
  });

  it('Kolos takes 0.85x damage', () => {
    const { state, boss } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    hurtBoss(state, boss, 100, 'H');
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(85, 9);
    expect(state.players[1].dmgToBoss).toBeCloseTo(85, 9);
  });

  it('Cień has 0.7x HP and 1.3x speed', () => {
    const hp = {};
    const dist = {};
    for (const type of ['cien', 'burza', 'kolos']) {
      const { state, boss } = bossArena(type, [
        { id: 'H', x: 0, y: 12 },
        { id: 'H2', x: -12, y: 4 },
      ]);
      hp[type] = boss.boss.maxHp;
      for (let i = 0; i < 60; i++) step(state, { B: inp({ moveX: 1, aimX: 10 }) });
      dist[type] = boss.x;
    }
    expect(hp.cien).toBe(Math.round(BOSS_COMMON.hpPerHero * 2 * 0.7));
    expect(hp.burza).toBe(BOSS_COMMON.hpPerHero * 2);
    expect(dist.burza).toBeCloseTo(BOSS_COMMON.speed, 6);
    expect(dist.cien).toBeCloseTo(BOSS_COMMON.speed * 1.3, 6);
    expect(dist.kolos).toBeCloseTo(BOSS_COMMON.speed * 0.7, 6);
  });

  it('Burza: after 3 hits the next ability area is 1.5x (once)', () => {
    const { state, boss, heroes } = bossArena('burza', [{ id: 'H', x: 4, y: 0 }]);
    const h = heroes[0];
    h.hp = 100;
    hurtHero(state, h, 1, 'B', 0, 0);
    hurtHero(state, h, 1, 'B', 0, 0);
    expect(boss.boss.overloaded).toBe(false);
    hurtHero(state, h, 1, 'B', 0, 0);
    expect(boss.boss.overloaded).toBe(true);

    // basic attack does not consume the overload
    step(state, { B: inp({ aimX: 4, buttons: BTN.ATTACK }) });
    expect(boss.boss.overloaded).toBe(true);
    for (let i = 0; i < 40; i++) step(state, {});

    step(state, { B: inp({ aimX: -4, aimY: 0, buttons: BTN.Q }) });
    const z1 = state.zones.find((z) => z.kind === 'lightning');
    expect(z1.r).toBeCloseTo(BOSSES.burza.q.radius * BOSSES.burza.overloadArea, 9);
    expect(boss.boss.overloaded).toBe(false);

    for (let i = 0; i < 60; i++) step(state, {});
    boss.boss.cd.q = 0;
    step(state, { B: inp({ aimX: -4, aimY: 0, buttons: BTN.Q }) });
    const z2 = state.zones.find((z) => z.kind === 'lightning');
    expect(z2.r).toBeCloseTo(BOSSES.burza.q.radius, 9);
  });

  it('Burza: overload is charged by real ability hits', () => {
    const { state, boss, heroes } = bossArena('burza', [{ id: 'H', x: 4, y: 0 }]);
    heroes[0].hp = 100;
    for (let k = 0; k < 3; k++) {
      boss.boss.cd.q = 0;
      heroes[0].invulnT = 0;
      step(state, { B: inp({ aimX: 4, buttons: BTN.Q }) });
      for (let i = 0; i < 50; i++) step(state, {});
    }
    expect(heroes[0].hp).toBe(97);
    expect(boss.boss.overloaded).toBe(true);
  });

  it('Nekromanta: at most 6 skeletons alive', () => {
    const { state, boss } = bossArena('nekromanta', [{ id: 'H', x: -12, y: 4 }]);
    for (let k = 0; k < 4; k++) {
      boss.boss.cd.q = 0;
      step(state, { B: inp({ aimX: 5, buttons: BTN.Q }) });
      for (let i = 0; i < 40; i++) step(state, {});
      expect(state.minions.length).toBeLessThanOrEqual(BOSSES.nekromanta.q.max);
    }
    expect(state.minions).toHaveLength(BOSSES.nekromanta.q.max);
    for (const m of state.minions) expect(m.hp).toBe(BOSSES.nekromanta.q.hp);
  });

  it('Nekromanta: drain heals the boss and damages the target', () => {
    const { state, boss, heroes } = bossArena('nekromanta', [{ id: 'H', x: 4, y: 0 }]);
    const C = BOSSES.nekromanta.e;
    boss.boss.hp = 100;
    step(state, { B: inp({ aimX: 4, buttons: BTN.E }) });
    let n = 0;
    while (boss.boss.channel?.kind !== 'drain' && n++ < 60) step(state, {});
    expect(boss.boss.channel?.kind).toBe('drain');
    const hp0 = boss.boss.hp;
    while (boss.boss.channel && n++ < 300) step(state, {});
    const healed = boss.boss.hp - hp0;
    expect(healed).toBeCloseTo(C.healPct * boss.boss.maxHp * C.duration, 0);
    expect(heroes[0].hp).toBe(HERO.hp - C.dps * C.duration);
  });

  it('Nekromanta: drain breaks when the target leaves range', () => {
    const { state, boss, heroes } = bossArena('nekromanta', [{ id: 'H', x: 4, y: 0 }]);
    boss.boss.hp = 100;
    step(state, { B: inp({ aimX: 4, buttons: BTN.E }) });
    let n = 0;
    while (boss.boss.channel?.kind !== 'drain' && n++ < 60) step(state, {});
    step(state, {});
    expect(boss.boss.channel?.kind).toBe('drain');
    heroes[0].x = BOSSES.nekromanta.e.breakRange + 1;
    step(state, {});
    expect(state.events.some((e) => e.t === 'drainBreak')).toBe(true);
    expect(boss.boss.channel).toBe(null);
    const hp = boss.boss.hp;
    for (let i = 0; i < 120; i++) step(state, {});
    expect(boss.boss.hp).toBe(hp);
    expect(heroes[0].hp).toBe(HERO.hp);
  });
});
