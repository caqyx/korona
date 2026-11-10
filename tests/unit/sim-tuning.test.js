/**
 * Strojenie zasad: „drugie szanse” w Boss Rush, odrodzenie na fali bossa w Przetrwaniu, bazowe HP klas,
 * czas odrodzenia w Koronie oraz poprawki ekonomii (roszczenie bez kaskady, dokładny licznik zabójstw).
 */
import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { createMatchState, createPlayer, cloneState, changeSkin, heroMaxHp } from '../../src/sim/state.js';
import { bindRng, bossKillValue, respawnHero, demoteToHero, promoteToBoss } from '../../src/sim/rules.js';
import { hurtBoss, hurtHero } from '../../src/sim/combat.js';
import { applyUpgradeEffect } from '../../src/sim/modes.js';
import { makeRng } from '../../src/sim/rng.js';
import { round3 } from '../../src/sim/vec.js';
import { validateSnapshotState } from '../../src/net/messages.js';
import { DT, SCORE, CLAIM, BOSSES, SKINS, SKIN_IDS, HERO, MODES, heroBaseHp, bossrushLives } from '../../src/sim/config.js';
import { bossArena, makeMatch, run, inp, BTN } from './sim-helpers.js';

const MELEE = ['rycerz', 'lotrzyk', 'inzynier', 'barbarzynca'];
const seconds = (s) => Math.round(s / DT);

function withRng(state, fn) {
  bindRng(makeRng(state.rng));
  try {
    return fn();
  } finally {
    bindRng(null);
  }
}

/** Zabija bohatera natychmiast (bez udziału bossa). */
function kill(state, h) {
  h.invulnT = 0;
  h.dashT = 0;
  h.hp = 1;
  withRng(state, () => hurtHero(state, h, 1, null, h.x, h.y));
  expect(h.alive).toBe(false);
}

const far = (ids, skin = 'kaplan') => ids.map((id, i) => ({ id, skin, x: 12 * Math.cos(1 + i), y: 12 * Math.sin(1 + i) }));

describe('Boss Rush: pula „drugich szans”', () => {
  const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `p${i}`, skin: 'mag' }));

  /** Mecz doprowadzony do walki z pierwszym bossem. */
  function rush(n) {
    const state = createMatchState({ seed: 5, players: players(n), countdown: 0, mode: 'bossrush', mapId: 'arena' });
    run(state, seconds(6));
    expect(state.modeData.stage).toBe('fight');
    expect(state.players.find((p) => p.ai).boss).toBeTruthy();
    return state;
  }

  it('liczba żyć zależy od liczby bohaterów: 1 → 3, 2 → 2, 3 i więcej → 1', () => {
    expect([1, 2, 3, 4, 6].map(bossrushLives)).toEqual([3, 2, 1, 1, 1]);
    expect(MODES.bossrush.lives).toEqual([3, 2, 1]);
    for (const n of [1, 2, 3]) {
      const md = createMatchState({ seed: 1, players: players(n), countdown: 0, mode: 'bossrush' }).modeData;
      expect([md.lives, md.livesMax]).toEqual([bossrushLives(n), bossrushLives(n)]);
    }
  });

  it('wspólna śmierć zabiera jedno życie (zdarzenie lifeLost), bohater odradza się normalnie; bez żyć — koniec', () => {
    const state = rush(1);
    const h = state.players[0];
    for (let left = bossrushLives(1) - 1; left >= 0; left--) {
      kill(state, h);
      step(state, {});
      expect(state.events.filter((e) => e.t === 'lifeLost')).toEqual([{ t: 'lifeLost', left }]);
      expect(state.modeData.lives).toBe(left);
      expect(state.phase).not.toBe('ended');
      // w trakcie tej samej śmierci kolejne kroki nie zabierają następnych żyć
      let lost = 0;
      for (let i = 0; i < seconds(MODES.bossrush.respawn) + 2 && !h.alive; i++) {
        step(state, {});
        lost += state.events.filter((e) => e.t === 'lifeLost').length;
      }
      expect(lost).toBe(0);
      expect(h.alive).toBe(true);
      expect(h.hp).toBe(h.maxHp);
    }
    kill(state, h);
    step(state, {});
    expect(state.phase).toBe('ended');
    expect(state.endReason).toBe('wipe');
    expect(state.modeData.lives).toBe(0);
    expect(state.modeData.livesMax).toBe(bossrushLives(1));
    expect(state.events.some((e) => e.t === 'lifeLost')).toBe(false);
  });

  it('śmierć części drużyny nie zabiera życia', () => {
    const state = rush(2);
    state.players[1].invulnT = 100;
    kill(state, state.players[0]);
    run(state, 30);
    expect(state.modeData.lives).toBe(bossrushLives(2));
    expect(state.phase).not.toBe('ended');
  });

  it('stan z życiami przechodzi przez JSON i walidację snapshotu', () => {
    const state = rush(1);
    kill(state, state.players[0]);
    step(state, {});
    expect(state.modeData.downed).toBe(true);
    expect(cloneState(state)).toEqual(state);
    expect(validateSnapshotState(cloneState(state))).toBe(true);
  });

  it('Przetrwanie nie ma żyć: wspólna śmierć kończy mecz od razu', () => {
    const state = createMatchState({ seed: 5, players: players(1), countdown: 0, mode: 'survival' });
    run(state, 200);
    expect(state.modeData.lives).toBeUndefined();
    kill(state, state.players[0]);
    step(state, {});
    expect(state.endReason).toBe('wipe');
  });
});

describe('Przetrwanie: odrodzenie na fali z bossem', () => {
  /** Dwóch bohaterów w trakcie fali; `bossWave` ustawiane ręcznie (fala 5 wymagałaby minut symulacji). */
  function wave(bossWave) {
    const players = ['a', 'b'].map((id) => ({ id, nick: id, skin: 'mag' }));
    const state = createMatchState({ seed: 5, countdown: 0, players, mode: 'survival' });
    run(state, 200);
    expect(state.modeData.stage).toBe('fight');
    state.modeData.bossWave = bossWave;
    return { state, a: state.players[0], b: state.players[1] };
  }

  it('na fali z bossem zabity wraca po bossWaveRespawn s zamiast siedzieć na ławce', () => {
    const { state, a, b } = wave(true);
    b.invulnT = 1000; // drugi bohater trzyma falę przy życiu
    kill(state, a);
    expect([a.benched, a.respawnT]).toEqual([false, MODES.survival.bossWaveRespawn]);
    run(state, seconds(MODES.survival.bossWaveRespawn) - 5);
    expect(a.alive).toBe(false);
    run(state, 10);
    expect(state.modeData.stage).toBe('fight');
    expect(a.alive).toBe(true);
    expect(a.hp).toBe(a.maxHp);
  });

  it('na fali z bossem wspólna śmierć nadal kończy mecz', () => {
    const { state, a, b } = wave(true);
    kill(state, a);
    kill(state, b);
    step(state, {});
    expect(state.endReason).toBe('wipe');
  });

  it('na zwykłej fali bez zmian: ławka do przerwy', () => {
    const { state, a, b } = wave(false);
    b.invulnT = 1000;
    kill(state, a);
    expect([a.benched, a.respawnT]).toEqual([true, 0]);
    run(state, seconds(MODES.survival.bossWaveRespawn) + 10);
    expect(state.modeData.stage).toBe('fight');
    expect([a.alive, a.benched]).toEqual([false, true]);
  });
});

describe('Bazowe HP klas', () => {
  it('klasy wręcz mają 4 HP, dystansowe HERO.hp (3)', () => {
    for (const skin of SKIN_IDS) {
      const expected = MELEE.includes(skin) ? 4 : HERO.hp;
      expect(heroBaseHp(skin), skin).toBe(expected);
      expect(SKINS[skin].attack.kind === 'melee', skin).toBe(MELEE.includes(skin));
      const p = createPlayer('x', 'x', skin, 0);
      expect([p.hp, p.maxHp], skin).toEqual([expected, expected]);
    }
  });

  it('odrodzenie i powrót z bossa na bohatera przywracają HP klasy', () => {
    const state = makeMatch([{ id: 'R', skin: 'rycerz' }, { id: 'M', skin: 'mag' }]);
    const [r, m] = state.players;
    for (const p of [r, m]) {
      p.hp = 1;
      respawnHero(state, p, makeRng(state.rng), 0);
      expect(p.hp, p.skin).toBe(heroBaseHp(p.skin));
      promoteToBoss(state, p, 'kolos');
      demoteToHero(state, p, makeRng(state.rng));
      expect([p.hp, p.maxHp], p.skin).toEqual([heroBaseHp(p.skin), heroBaseHp(p.skin)]);
    }
  });

  it('„+1 serce” dodaje się do bazowego HP klasy i przeżywa odrodzenie', () => {
    const state = makeMatch([{ id: 'R', skin: 'barbarzynca' }, { id: 'M', skin: 'druid' }]);
    for (const p of state.players) {
      applyUpgradeEffect(p, 'vit');
      expect([p.hp, p.maxHp], p.skin).toEqual([heroBaseHp(p.skin) + 1, heroBaseHp(p.skin) + 1]);
      p.hp = 1;
      respawnHero(state, p, makeRng(state.rng), 0);
      expect(p.hp, p.skin).toBe(heroBaseHp(p.skin) + 1);
    }
  });

  it('stan bez pola maxHp (starszy snapshot) korzysta z bazowego HP klasy', () => {
    expect(heroMaxHp({ skin: 'lotrzyk' })).toBe(4);
    expect(heroMaxHp({ skin: 'lucznik' })).toBe(HERO.hp);
    expect(heroMaxHp({ skin: 'lucznik', maxHp: 6 })).toBe(6);
  });

  it('zmiana klasy po śmierci podmienia bazowe HP, serca z ulepszeń zostają', () => {
    const p = createPlayer('x', 'x', 'mag', 0);
    applyUpgradeEffect(p, 'vit');
    changeSkin(p, 'rycerz');
    expect([p.skin, p.maxHp]).toEqual(['rycerz', 5]);
    changeSkin(p, 'druid');
    expect([p.skin, p.maxHp]).toEqual(['druid', 4]);
  });

  it('zmiana klasy inputem: martwy Mag wraca jako Rycerz z 4 HP', () => {
    const { state, heroes } = bossArena('kolos', far(['H', 'K'], 'mag'));
    const h = heroes[0];
    kill(state, h);
    step(state, { H: inp({ skin: 'rycerz' }) });
    expect([h.skin, h.maxHp]).toEqual(['rycerz', 4]);
    for (let i = 0; i < seconds(HERO.respawnTime) + 2 && !h.alive; i++) step(state, { H: inp({ skin: 'rycerz' }) });
    expect([h.alive, h.hp, h.maxHp]).toEqual([true, 4, 4]);
  });

  it('Aura Kapłana leczy Rycerza do 4 HP', () => {
    const { state } = bossArena('kolos', [
      { id: 'P', skin: 'kaplan', x: 6, y: 0 },
      { id: 'R', skin: 'rycerz', x: 7, y: 0 },
    ]);
    const r = state.players[2];
    r.hp = 3;
    step(state, { P: inp({ buttons: BTN.ABILITY }) });
    expect(r.hp).toBe(4);
  });
});

describe('Korona: odrodzenie bohatera po HERO.respawnTime = 2 s', () => {
  it('zabity bohater wraca po 2 s', () => {
    expect(HERO.respawnTime).toBe(2);
    const { state, heroes } = bossArena('kolos', far(['H', 'K']));
    const h = heroes[0];
    kill(state, h);
    expect(h.respawnT).toBe(HERO.respawnTime);
    run(state, seconds(2) - 3);
    expect(h.alive).toBe(false);
    run(state, 6);
    expect(h.alive).toBe(true);
  });

  it('Boss Rush zachowuje własny czas odrodzenia', () => {
    expect(MODES.bossrush.respawn).toBe(5);
  });
});

describe('Roszczenie do korony nie przenosi się kaskadowo', () => {
  /** Zadaje bossowi podane części jego maks. HP (ostatni wpis dobija z minimalnym zapasem). */
  function deal(state, boss, shares) {
    const max = boss.boss.maxHp;
    const mul = BOSSES[boss.boss.type].dmgTakenMul;
    withRng(state, () => shares.forEach(([id, share], i) => hurtBoss(state, boss, (share * max) / mul + (i === shares.length - 1 ? 1e-6 : 0), id)));
  }
  const finish = (state) => {
    for (let n = 0; state.phase === 'transition' && n < 1000; n++) step(state, {});
  };

  it('bazą roszczenia są tylko świeże obrażenia: bez nich w panowaniu roszczenie wygasa', () => {
    const { state, boss, heroes } = bossArena('burza', far(['X', 'Y', 'Z']));
    const [x, y, z] = heroes;
    deal(state, boss, [['Y', 0.3], ['Z', 0.2], ['X', 0.5]]);
    finish(state);
    expect(x.boss).toBeTruthy();
    expect(y.claim0).toBeGreaterThan(0);
    expect(z.claim0).toBeGreaterThan(0);
    // drugie panowanie: Y nie zadaje nic, Z zadaje 40%, były boss B dobija 60%
    deal(state, x, [['Z', 0.4], ['B', 0.6]]);
    finish(state);
    expect(boss.boss).toBeTruthy();
    const newMax = boss.boss.maxHp;
    expect([y.claim0, y.dmgToBoss]).toEqual([0, 0]);
    expect(z.claim0).toBe(round3(CLAIM.carry * 0.4 * newMax));
    expect(z.dmgToBoss).toBe(z.claim0);
  });
});

describe('Punkty za zabójstwa: dokładna suma ułamków (killAcc w jednostkach 1/killUnits)', () => {
  /** Zabija bohatera `n` razy (z ręcznym wskrzeszeniem); zwraca `pts` kolejnych zdarzeń heroDie. */
  function kills(state, victim, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      victim.alive = true;
      victim.hp = 1;
      victim.invulnT = 0;
      state.events = [];
      expect(hurtHero(state, victim, 1, 'B', 0, 0)).toBe(true);
      pts.push(state.events.find((e) => e.t === 'heroDie').pts);
    }
    return pts;
  }
  const seven = () => bossArena('kolos', far(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']), { maxPlayers: 8 });

  it('7 bohaterów: 7 zabójstw = 6 pkt, 14 zabójstw = 12 pkt, licznik wraca do zera', () => {
    const { state, boss, heroes } = seven();
    expect(heroes.length).toBe(7);
    const first = kills(state, heroes[0], 7);
    expect(first.reduce((a, b) => a + b, 0)).toBe(6);
    expect([boss.score, boss.killAcc]).toEqual([6, 0]);
    kills(state, heroes[1], 7);
    expect([boss.score, boss.killAcc, boss.bossKills]).toEqual([12, 0, 14]);
  });

  it('licznik jest liczbą całkowitą po każdym zabójstwie (brak dryfu po kwantyzacji snapshotu)', () => {
    const { state, boss, heroes } = seven();
    for (let i = 0; i < 20; i++) {
      kills(state, heroes[i % 7], 1);
      expect(Number.isInteger(boss.killAcc)).toBe(true);
      expect(boss.killAcc).toBeLessThan(SCORE.killUnits);
      expect(boss.score * SCORE.killUnits + boss.killAcc).toBe(((i + 1) * 6 * SCORE.killUnits) / 7);
    }
  });

  it('killUnits dzieli się przez każdą możliwą liczbę bohaterów', () => {
    for (let n = 1; n <= 8; n++) expect(SCORE.killUnits % n, `n=${n}`).toBe(0);
  });

  it('bossKillValue: pełna wartość do killRefHeroes bohaterów, potem proporcjonalnie mniej; działa na zwykłym obiekcie widoku', () => {
    const view = (n, mode) => ({ mode, players: [{ id: 'B', boss: { type: 'kolos' }, connected: true, dnf: false }, ...Array.from({ length: n }, (_, i) => ({ id: `h${i}`, boss: null, connected: true, dnf: false }))] });
    expect(bossKillValue(view(2))).toBe(SCORE.bossKillsHero);
    expect(bossKillValue(view(3, 'crown'))).toBe(SCORE.bossKillsHero);
    expect(bossKillValue(view(4, 'crown'))).toBeCloseTo(1.5, 9);
    expect(bossKillValue(view(7, 'crown'))).toBeCloseTo(6 / 7, 9);
    expect(bossKillValue(view(7, 'teams'))).toBe(SCORE.bossKillsHero);
    const { state } = seven();
    expect(bossKillValue(cloneState(state))).toBeCloseTo(6 / 7, 9);
  });
});

describe('Boss Cień', () => {
  it('ma 0,9× HP (Pajęczyca bez zmian)', () => {
    expect(BOSSES.cien.hpMul).toBe(0.9);
    expect(BOSSES.pajeczyca.hpMul).toBe(0.9);
  });
});
