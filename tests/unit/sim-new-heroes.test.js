import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { SKINS, DT, BOSS_COMMON, BOSSES } from '../../src/sim/config.js';
import { bossArena, inp, BTN } from './sim-helpers.js';

describe('nowe klasy', () => {
  it('Mag: Meteor spada po telegrafie w wybrany punkt i rani bossa', () => {
    const { state, boss } = bossArena('kolos', [{ id: 'M', skin: 'mag', x: -6, y: 0 }]);
    const m = state.players[1];
    const hp0 = boss.boss.hp;
    step(state, { M: inp({ buttons: BTN.ABILITY, aimX: 0, aimY: 0 }) });
    expect(m.abilCd).toBeCloseTo(SKINS.mag.ability.cd, 6);
    const z = state.zones.find((x) => x.kind === 'meteorHero');
    expect(z.team).toBe('hero');
    const tg = Math.round(SKINS.mag.ability.telegraph / DT);
    for (let i = 0; i < tg - 2; i++) step(state, {});
    expect(boss.boss.hp).toBe(hp0);
    for (let i = 0; i < 6; i++) step(state, {});
    expect(hp0 - boss.boss.hp).toBeCloseTo(SKINS.mag.ability.dmg * BOSSES.kolos.dmgTakenMul, 6);
  });

  it('Barbarzyńca: Szał skraca odnowienie ataku i przyspiesza ruch', () => {
    const { state } = bossArena('kolos', [{ id: 'B2', skin: 'barbarzynca', x: -8, y: 5 }]);
    const b = state.players[1];
    step(state, { B2: inp({ buttons: BTN.ABILITY }) });
    expect(b.abilT).toBeGreaterThan(0);
    b.atkCd = 0;
    step(state, { B2: inp({ buttons: BTN.ATTACK, aimX: 0, aimY: 0 }) });
    expect(b.atkCd).toBeCloseTo(SKINS.barbarzynca.attack.cd * SKINS.barbarzynca.ability.atkCdMul, 6);
  });

  it('Druid: Korzenie spowalniają bossa i zadają obrażenia co 0,5 s', () => {
    const { state, boss } = bossArena('burza', [{ id: 'D', skin: 'druid', x: -6, y: 0 }]);
    const hp0 = boss.boss.hp;
    step(state, { D: inp({ buttons: BTN.ABILITY, aimX: 0, aimY: 0 }) });
    for (let i = 0; i < 60; i++) step(state, {});
    expect(boss.slowT).toBeGreaterThan(0);
    expect(hp0 - boss.boss.hp).toBeGreaterThanOrEqual(SKINS.druid.ability.dmg);
    const x0 = boss.x;
    step(state, { B: inp({ moveX: 1 }) });
    expect(boss.x - x0).toBeCloseTo(BOSS_COMMON.speed * BOSSES.burza.speedMul * (1 - SKINS.druid.ability.slow) * DT, 4);
  });

  it('wręcz zadaje więcej niż dystans (ryzyko vs. bezpieczeństwo), ale rozrzut DPS ataku podstawowego ≤ 3,4× (dystans nadrabia umiejętnościami)', () => {
    const dps = Object.fromEntries(Object.entries(SKINS).map(([k, s]) => [k, s.attack.dmg / s.attack.cd]));
    const vals = Object.values(dps);
    expect(Math.max(...vals) / Math.min(...vals)).toBeLessThanOrEqual(3.4);
    expect(dps.rycerz).toBeGreaterThan(dps.lucznik);
    expect(dps.barbarzynca).toBeGreaterThan(dps.mag);
  });
});
