/**
 * Sprzątanie po śmierci bossa: pociski i strefy wyczyszczone w trakcie pętli aktualizacji nie mogą
 * wrócić do stanu, a boss AI w Boss Rush nie leczy się za zabójstwa (bieg musi się dać skończyć).
 */
import { describe, it, expect } from 'vitest';
import { mergeKept } from '../../src/sim/vec.js';
import { spawnProjectile } from '../../src/sim/projectiles.js';
import { step } from '../../src/sim/step.js';
import { hurtHero } from '../../src/sim/combat.js';
import { bindRng } from '../../src/sim/rules.js';
import { createMatchState } from '../../src/sim/state.js';
import { makeRng } from '../../src/sim/rng.js';
import { BOSSES, DT } from '../../src/sim/config.js';
import { bossArena, run } from './sim-helpers.js';

function withRng(state, fn) {
  bindRng(makeRng(state.rng));
  try {
    return fn();
  } finally {
    bindRng(null);
  }
}

describe('mergeKept', () => {
  it('lista niepodmieniona: wynik to keep', () => {
    const list = [1, 2, 3];
    const keep = [1, 3];
    expect(mergeKept(list, list, keep)).toBe(keep);
  });

  it('lista podmieniona: zostają ocalałe po czyszczeniu i elementy dodane po nim', () => {
    const before = ['a', 'b', 'c'];
    const current = ['a', 'c', 'nowy']; // czyszczenie usunęło b, potem doszedł „nowy”
    expect(mergeKept(before, current, ['a', 'b'])).toEqual(['a', 'nowy']);
  });
});

describe('pociski bossa po jego śmierci (tryby z bossem AI)', () => {
  it('pocisk bohatera dobija bossa AI — pociski bossa z tej samej pętli znikają i nikogo już nie ranią', () => {
    const state = createMatchState({ seed: 5, players: [{ id: 'p0', nick: 'p0', skin: 'lucznik' }], countdown: 0, mode: 'bossrush', mapId: 'arena' });
    run(state, Math.round(6 / DT));
    const ai = state.players.find((p) => p.ai);
    const hero = state.players[0];
    expect(ai.boss).toBeTruthy();
    Object.assign(ai, { x: 0, y: 0 });
    Object.assign(hero, { x: -8, y: 0, invulnT: 0, dashT: 0 });
    ai.boss.hp = 0.01;
    state.projectiles = [];
    // kolejność w tablicy: zabójczy pocisk bohatera, PO nim pocisk bossa tuż przed bohaterem
    spawnProjectile(state, { team: 'hero', ownerId: 'p0', x: 1.2, y: 0, vx: -20, vy: 0, dmg: 5, range: 20 });
    spawnProjectile(state, { team: 'boss', ownerId: ai.id, kind: 'necroBolt', x: -7.4, y: 0, vx: -20, vy: 0, dmg: 1, range: 20 });
    step(state, {});
    expect(ai.boss).toBeNull();
    expect(state.projectiles.filter((p) => p.team !== 'hero')).toEqual([]);
    expect(state.events.filter((e) => e.t === 'heroHit')).toEqual([]);
  });
});

describe('Boss Rush: boss AI nie leczy się za zabójstwa', () => {
  const kill = (state, h, by) => {
    h.invulnT = 0;
    h.dashT = 0;
    h.hp = 1;
    withRng(state, () => hurtHero(state, h, 1, by, h.x + 1, h.y));
    expect(h.alive).toBe(false);
  };

  it('Widmo (AI) po zabójstwie ma tyle samo HP; w Koronie pasywka działa jak dotąd', () => {
    const state = createMatchState({ seed: 5, players: [{ id: 'p0', nick: 'p0', skin: 'mag' }], countdown: 0, mode: 'bossrush', mapId: 'arena' });
    run(state, Math.round(6 / DT));
    const ai = state.players.find((p) => p.ai);
    expect(ai.boss).toBeTruthy();
    ai.boss.type = 'widmo';
    ai.boss.hp = ai.boss.maxHp / 2;
    kill(state, state.players[0], ai.id);
    expect(ai.boss.hp).toBe(ai.boss.maxHp / 2);

    const crown = bossArena('widmo', [{ id: 'X', skin: 'mag', x: 8, y: 0 }, { id: 'Y', skin: 'mag', x: -8, y: 0 }]);
    crown.boss.boss.hp = crown.boss.boss.maxHp / 2;
    kill(crown.state, crown.heroes[0], 'B');
    expect(crown.boss.boss.hp).toBeCloseTo(crown.boss.boss.maxHp * (0.5 + BOSSES.widmo.passive.healOnKill), 6);
  });
});
