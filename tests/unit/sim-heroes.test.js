import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { hurtHero } from '../../src/sim/combat.js';
import { SKINS, HERO, SCORE, DT } from '../../src/sim/config.js';
import { bossArena, run, inp, BTN } from './sim-helpers.js';

/** Szuka liczby kroków do spełnienia warunku. */
function stepsUntil(state, inputsFn, cond, max = 600) {
  for (let i = 1; i <= max; i++) {
    step(state, inputsFn(i));
    if (cond()) return i;
  }
  return -1;
}

describe('common hero rules', () => {
  it('invulnerable or dashing heroes take no damage', () => {
    const { state, heroes } = bossArena('kolos', [{ id: 'H', x: 4, y: 0 }]);
    const h = heroes[0];
    h.invulnT = 0.5;
    expect(hurtHero(state, h, 1, 'B', 0, 0)).toBe(false);
    h.invulnT = 0;
    h.dashT = 0.1;
    expect(hurtHero(state, h, 1, 'B', 0, 0)).toBe(false);
    h.dashT = 0;
    expect(hurtHero(state, h, 1, 'B', 0, 0)).toBe(true);
    expect(h.hp).toBe(HERO.hp - 1);
  });

  it('dash has the configured cooldown', () => {
    const { state, heroes } = bossArena('kolos', [{ id: 'H', x: 4, y: 6 }]);
    step(state, { H: inp({ buttons: BTN.DASH, moveX: 1 }) });
    expect(heroes[0].dashCd).toBeCloseTo(HERO.dashCooldown, 9);
    expect(heroes[0].dashT).toBeGreaterThan(0);
  });
});

describe('Rycerz: shield', () => {
  const C = SKINS.rycerz.ability;

  function knightVsKolosMelee({ shield, aimX }) {
    const { state, heroes } = bossArena('kolos', [{ id: 'K', skin: 'rycerz', x: 2, y: 0 }]);
    const k = heroes[0];
    const kIn = (buttons = 0) => inp({ aimX, aimY: 0, buttons });
    step(state, { K: kIn(shield ? BTN.ABILITY : 0), B: inp({ aimX: 2, aimY: 0, buttons: BTN.ATTACK }) });
    if (shield) {
      expect(k.abilCd).toBeCloseTo(C.cd, 9);
      expect(k.abilT).toBeCloseTo(C.duration, 9);
    }
    const events = [];
    for (let i = 0; i < 40; i++) {
      step(state, { K: kIn() });
      events.push(...state.events);
    }
    return { k, events };
  }

  it('blocks frontal boss melee while active', () => {
    const { k, events } = knightVsKolosMelee({ shield: true, aimX: 0 });
    expect(k.hp).toBe(HERO.hp);
    expect(events.some((e) => e.t === 'block' && e.id === 'K')).toBe(true);
  });

  it('without shield the same hit lands', () => {
    const { k } = knightVsKolosMelee({ shield: false, aimX: 0 });
    expect(k.hp).toBe(HERO.hp - 1);
  });

  it('does not block hits from behind', () => {
    const { k } = knightVsKolosMelee({ shield: true, aimX: 10 });
    expect(k.hp).toBe(HERO.hp - 1);
  });

  it('reflects a boss projectile toward the boss, dealing reflectDmg', () => {
    const { state, boss, heroes } = bossArena('burza', [{ id: 'K', skin: 'rycerz', x: 4, y: 0 }]);
    const k = heroes[0];
    step(state, { K: inp({ buttons: BTN.ABILITY }), B: inp({ aimX: 4, aimY: 0, buttons: BTN.ATTACK }) });
    let reflected = null;
    const events = [];
    for (let i = 0; i < 80; i++) {
      step(state, {});
      events.push(...state.events);
      if (!reflected) reflected = state.projectiles.find((p) => p.kind === 'reflected') || null;
      if (reflected && reflected.team === 'hero' && reflected.vx < 0) {
        expect(reflected.ownerId).toBe('K');
        expect(reflected.dmg).toBe(C.reflectDmg);
      }
    }
    expect(reflected).not.toBe(null);
    expect(events.some((e) => e.t === 'reflect' && e.id === 'K')).toBe(true);
    expect(k.hp).toBe(HERO.hp);
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(C.reflectDmg, 9);
    expect(events.some((e) => e.t === 'bossHit' && e.by === 'K')).toBe(true);
  });
});

describe('Łucznik: piercing shot', () => {
  const C = SKINS.lucznik.ability;

  it('charges 0.6 s, then fires a 30 dmg projectile that pierces boss and minions', () => {
    const { state, boss } = bossArena('nekromanta', [
      { id: 'A', skin: 'lucznik', x: -6, y: 0 },
      { id: 'Far', x: 0, y: 12 },
    ]);
    state.minions.push({ id: 999, ownerId: 'B', x: 3, y: 0, hp: 15, maxHp: 15, r: 0.45, cd: 100, windup: 100, fx: 1, fy: 0 });
    step(state, { A: inp({ buttons: BTN.ABILITY }) });
    const a = state.players[1];
    expect(a.abilCd).toBeCloseTo(C.cd, 9);
    expect(a.abilT).toBeCloseTo(C.charge, 9);
    expect(state.projectiles).toHaveLength(0);
    // holding attack while charging must not fire basic arrows
    let boltsDuringCharge = 0;
    const n = stepsUntil(
      state,
      () => ({ A: inp({ buttons: BTN.ATTACK }) }),
      () => {
        const fired = state.projectiles.some((p) => p.kind === 'pierce');
        if (!fired) boltsDuringCharge += state.projectiles.filter((p) => p.kind === 'bolt').length;
        return fired;
      },
    );
    expect(n * DT).toBeGreaterThanOrEqual(C.charge - 1e-9);
    expect(n * DT).toBeLessThanOrEqual(C.charge + DT + 1e-9);
    expect(boltsDuringCharge).toBe(0);
    state.projectiles = state.projectiles.filter((p) => p.kind === 'pierce');
    const pr = state.projectiles.find((p) => p.kind === 'pierce');
    expect(pr.dmg).toBe(C.dmg);
    expect(pr.pierce).toBe(true);
    const events = [];
    for (let i = 0; i < 60; i++) {
      step(state, {});
      events.push(...state.events);
    }
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(C.dmg, 9);
    expect(events.filter((e) => e.t === 'bossHit' && e.by === 'A')).toHaveLength(1);
    expect(events.some((e) => e.t === 'minionDie')).toBe(true);
    expect(state.minions).toHaveLength(0);
  });
});

describe('Łotrzyk: shadow step', () => {
  const C = SKINS.lotrzyk.ability;

  it('teleports behind the boss when within 5 m and the next attack deals x3', () => {
    const { state, boss } = bossArena('nekromanta', [{ id: 'R', skin: 'lotrzyk', x: 0, y: 6.1 }]);
    const r = state.players[1];
    step(state, { R: inp({ buttons: BTN.ABILITY }) });
    expect(r.abilCd).toBeCloseTo(C.cd, 9);
    expect(r.buffMult).toBe(C.mult);
    // boss faces +x, so "behind" is -x
    expect(r.x).toBeLessThan(-1.5);
    expect(Math.abs(r.y)).toBeLessThan(1e-6);
    expect(r.fx).toBeCloseTo(1, 6);
    step(state, { R: inp({ buttons: BTN.ATTACK }) });
    const dmg1 = boss.boss.maxHp - boss.boss.hp;
    expect(dmg1).toBeCloseTo(SKINS.lotrzyk.attack.dmg * C.mult, 9);
    expect(r.buffMult).toBe(1);
    run(state, 30, () => ({ R: inp({ buttons: BTN.ATTACK }) }));
    const hits = (boss.boss.maxHp - boss.boss.hp - dmg1) / SKINS.lotrzyk.attack.dmg;
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(hits).toBeCloseTo(Math.round(hits), 6); // later attacks deal plain x1 damage
  });

  it('does nothing (and keeps cooldown) when the boss is farther than 5 m', () => {
    const { state } = bossArena('nekromanta', [{ id: 'R', skin: 'lotrzyk', x: 0, y: 7 }]);
    const r = state.players[1];
    step(state, { R: inp({ buttons: BTN.ABILITY }) });
    expect(r.abilCd).toBe(0);
    expect(r.y).toBeCloseTo(7, 9);
    expect(r.buffMult).toBe(1);
  });
});

describe('Kapłan: aura', () => {
  const C = SKINS.kaplan.ability;

  it('heals 1 HP to every hero within 3 m, including rivals and self, capped at max', () => {
    const { state } = bossArena('kolos', [
      { id: 'P', skin: 'kaplan', x: 5, y: 0 },
      { id: 'R1', x: 7, y: 0 },
      { id: 'R2', x: 5, y: 2.5 },
      { id: 'Full', x: 4, y: 1 },
      { id: 'Far', x: 10, y: 0 },
    ]);
    const [p, r1, r2, full, far] = state.players.slice(1);
    p.hp = 2;
    r1.hp = 1;
    r2.hp = 2;
    far.hp = 1;
    step(state, { P: inp({ buttons: BTN.ABILITY }) });
    expect(p.abilCd).toBeCloseTo(C.cd, 9);
    expect(p.hp).toBe(3);
    expect(r1.hp).toBe(2);
    expect(r2.hp).toBe(3);
    expect(full.hp).toBe(3);
    expect(far.hp).toBe(1);
    expect(state.players[0].boss.hp).toBe(state.players[0].boss.maxHp);
  });
});

describe('Inżynier: turret', () => {
  const C = SKINS.inzynier.ability;

  it('places a turret that shoots the boss for 4 dmg and expires after 6 s', () => {
    const { state, boss } = bossArena('nekromanta', [{ id: 'E', skin: 'inzynier', x: -5, y: 0 }]);
    const e = state.players[1];
    step(state, { E: inp({ buttons: BTN.ABILITY }) });
    expect(e.abilCd).toBeCloseTo(C.cd, 9);
    expect(state.turrets).toHaveLength(1);
    expect(state.turrets[0].ownerId).toBe('E');
    const events = [];
    for (let i = 0; i < 60; i++) {
      step(state, {});
      events.push(...state.events);
    }
    const hits = events.filter((ev) => ev.t === 'bossHit' && ev.by === 'E');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) expect(h.dmg).toBe(C.dmg);
    expect(boss.boss.maxHp - boss.boss.hp).toBeCloseTo(C.dmg * hits.length, 9);
    expect(e.dmgToBoss).toBeCloseTo(C.dmg * hits.length, 9);
    run(state, Math.ceil(C.life / DT));
    expect(state.turrets).toHaveLength(0);
  });

  it('turret last hit counts as the engineer last hit', () => {
    const { state, boss } = bossArena('nekromanta', [
      { id: 'E', skin: 'inzynier', x: -5, y: 0 },
      { id: 'O', x: 0, y: 12 },
    ]);
    const e = state.players[1];
    step(state, { E: inp({ buttons: BTN.ABILITY }) });
    boss.boss.hp = 3;
    const n = stepsUntil(state, () => ({}), () => state.phase === 'transition', 120);
    expect(n).toBeGreaterThan(0);
    expect(state.transition.newBossId).toBe('E');
    expect(state.transition.bonus).toBe(true);
    expect(e.score).toBe(SCORE.lastHit);
    expect(e.lastHits).toBe(1);
  });
});
