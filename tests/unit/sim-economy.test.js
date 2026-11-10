/**
 * Ekonomia korony (roszczenia, asysty, punkty za zabójstwa, równy start, rozstrzyganie remisów)
 * oraz poprawki zasad: overkill, tarcza Rycerza, „ławka” zamiast Infinity, Aura w drużynach, ogłuszenie.
 */
import { describe, it, expect } from 'vitest';
import { step } from '../../src/sim/step.js';
import { createMatchState, cloneState } from '../../src/sim/state.js';
import { bindRng, drawBossType, assistShare, respawnHero, disconnectPlayer } from '../../src/sim/rules.js';
import { hurtBoss, hurtHero, shieldBlocks } from '../../src/sim/combat.js';
import { mapStartPoints, mapSpawnPoint } from '../../src/sim/physics.js';
import { addZone } from '../../src/sim/zones.js';
import { makeRng } from '../../src/sim/rng.js';
import { MAPS, MAP_IDS } from '../../src/sim/maps.js';
import { DT, MATCH, SCORE, CLAIM, BOSSES, SKINS, HERO } from '../../src/sim/config.js';
import { makeMatch, bossArena, run, inp, press, BTN } from './sim-helpers.js';

const round3 = (v) => Math.round(v * 1000) / 1000;

function withRng(state, fn) {
  bindRng(makeRng(state.rng));
  try {
    return fn();
  } finally {
    bindRng(null);
  }
}

function finishTransition(state) {
  for (let n = 0; state.phase === 'transition' && n < 1000; n++) step(state, {});
}

/** Zadaje bossowi podane części jego maks. HP (ostatni wpis zwykle dobija). */
function deal(state, boss, shares) {
  const max = boss.boss.maxHp;
  const mul = BOSSES[boss.boss.type].dmgTakenMul;
  // gdy udziały sumują się do 100%, ostatni cios dostaje minimalny zapas: suma ułamków w zmiennym
  // przecinku potrafi zostawić bossowi ~1e-13 HP (overkill i tak nie liczy się do roszczenia)
  const kills = shares.reduce((s, [, share]) => s + share, 0) >= 1 - 1e-9;
  withRng(state, () => {
    shares.forEach(([id, share], i) => hurtBoss(state, boss, (share * max) / mul + (kills && i === shares.length - 1 ? 1e-6 : 0), id));
  });
}

/** Rozstawia bohaterów daleko od bossa i siebie, żeby nic przypadkiem nie trafiało. */
const far = (ids, skin = 'kaplan') => ids.map((id, i) => ({ id, skin, x: 12 * Math.cos(1 + i), y: 12 * Math.sin(1 + i) }));

describe('A1: roszczenie przechodzi na następne panowanie (CLAIM.carry)', () => {
  it('po śmierci bossa bohater bez korony zaczyna z carry × udział × nowe maks. HP; nowy i były boss od zera', () => {
    const { state, boss, heroes } = bossArena('burza', far(['X', 'Y', 'Z']));
    const [x, y, z] = heroes;
    const oldMax = boss.boss.maxHp;
    deal(state, boss, [['X', 0.5], ['Y', 0.3], ['Z', 0.2]]);
    expect(state.transition.newBossId).toBe('X');
    finishTransition(state);
    const newMax = x.boss.maxHp;
    expect(y.claim0).toBe(round3(CLAIM.carry * 0.3 * newMax));
    expect(z.claim0).toBe(round3(CLAIM.carry * 0.2 * newMax));
    expect(y.dmgToBoss).toBe(y.claim0);
    expect(z.dmgToBoss).toBe(z.claim0);
    expect([x.dmgToBoss, x.claim0]).toEqual([0, 0]);
    expect([boss.dmgToBoss, boss.claim0]).toEqual([0, 0]);
    // statystyka życiowa liczy tylko faktycznie zadane obrażenia
    expect(y.dmgTotal).toBeCloseTo(0.3 * oldMax, 6);
    expect(z.dmgTotal).toBeCloseTo(0.2 * oldMax, 6);
  });

  it('korona nadal idzie do największego dmgToBoss — przeniesione roszczenie może przeważyć świeże obrażenia', () => {
    const { state, boss, heroes } = bossArena('burza', far(['X', 'Y', 'Z']));
    const [x, y] = heroes;
    deal(state, boss, [['X', 0.5], ['Y', 0.3], ['Z', 0.2]]);
    finishTransition(state);
    const before = y.score; // asysta z pierwszego panowania (30% ≥ progu)
    expect(before).toBe(SCORE.assist);
    // Y ma 9% roszczenia; były boss B zadaje 48%, Y 43% świeżych → Y: 52% > B: 48%
    deal(state, x, [['B', 0.48], ['Y', 0.43], ['Z', 0.09]]);
    expect(state.transition.newBossId).toBe('Y');
    expect(y.lastHits).toBe(1);
    expect(y.score).toBe(before + SCORE.lastHit);
  });

  it('upadek korony i podniesienie ze środka zerują roszczenia (brak przeniesienia)', () => {
    const { state, boss, heroes } = bossArena('burza', far(['X', 'Y', 'Z']));
    const [x, y, z] = heroes;
    deal(state, boss, [['X', 0.5], ['Y', 0.3], ['Z', 0.2]]);
    finishTransition(state);
    expect(y.claim0).toBeGreaterThan(0);
    deal(state, x, [['Z', 0.1]]);
    disconnectPlayer(state, 'X'); // boss wychodzi → korona na środek
    expect(state.crown.state).toBe('center');
    for (const p of state.players) expect([p.id, p.dmgToBoss, p.claim0]).toEqual([p.id, 0, 0]);
    y.x = 0.3;
    y.y = 0;
    step(state, {});
    expect(state.transition.bonus).toBe(false);
    finishTransition(state);
    expect(y.boss).toBeTruthy();
    for (const p of state.players) expect([p.id, p.dmgToBoss, p.claim0]).toEqual([p.id, 0, 0]);
    expect(z.dmgTotal).toBeGreaterThan(0);
  });

  it('nowe pola przechodzą przez JSON bez zmian', () => {
    const { state, boss } = bossArena('burza', far(['X', 'Y', 'Z']));
    deal(state, boss, [['X', 0.5], ['Y', 0.3], ['Z', 0.2]]);
    finishTransition(state);
    expect(cloneState(state)).toEqual(state);
  });
});

describe('A2: asysta wymaga świeżych obrażeń w tym panowaniu', () => {
  it('próg = min(assistThreshold, assistPool / bohaterowie)', () => {
    expect(assistShare(1)).toBe(0.25);
    expect(assistShare(3)).toBe(0.25);
    expect(assistShare(4)).toBeCloseTo(0.1875, 12);
    expect(assistShare(5)).toBeCloseTo(0.15, 12);
    expect(assistShare(7)).toBeCloseTo(0.75 / 7, 12);
  });

  it('przeniesione roszczenie nie liczy się do asysty', () => {
    const { state, boss, heroes } = bossArena('burza', far(['X', 'Y', 'Z']));
    const [x, , z] = heroes;
    deal(state, boss, [['X', 0.5], ['Y', 0.3], ['Z', 0.2]]);
    finishTransition(state);
    const zScore = z.score;
    // Z: 6% roszczenia + 22% świeżych = 28% ≥ 25%, ale świeżych < 25% → bez asysty; B: 25% świeżych → asysta
    deal(state, x, [['Z', 0.22], ['B', 0.25], ['Y', 0.53]]);
    expect(state.transition.newBossId).toBe('Y');
    expect(z.dmgToBoss / x.boss.maxHp).toBeGreaterThan(SCORE.assistThreshold);
    expect(z.score).toBe(zScore);
    expect(boss.score).toBe(SCORE.assist);
    expect(state.events.filter((e) => e.t === 'assist').map((e) => e.id)).toEqual(['B']);
  });

  it('5 bohaterów: 16% świeżych obrażeń daje asystę (próg 15%), 14% — nie', () => {
    const { state, boss, heroes } = bossArena('burza', far(['A', 'C', 'D', 'E', 'F']), { maxPlayers: 8 });
    const [, c, d] = heroes;
    deal(state, boss, [['C', 0.16], ['D', 0.14], ['A', 0.7]]);
    expect(state.transition.newBossId).toBe('A');
    expect(c.score).toBe(SCORE.assist);
    expect(d.score).toBe(0);
  });
});

describe('A3: punkty bossa za zabójstwo maleją powyżej killRefHeroes bohaterów', () => {
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

  it('≤3 bohaterów: jak dotąd, pełne bossKillsHero za każde zabójstwo', () => {
    const { state, boss, heroes } = bossArena('kolos', far(['H1', 'H2', 'H3']));
    expect(kills(state, heroes[0], 3)).toEqual([2, 2, 2]);
    expect(boss.score).toBe(3 * SCORE.bossKillsHero);
    expect(boss.killAcc).toBe(0);
  });

  it('4 bohaterów: 1,5 pkt za zabójstwo — do wyniku trafiają tylko całe punkty', () => {
    const { state, boss, heroes } = bossArena('kolos', far(['H1', 'H2', 'H3', 'H4']));
    expect(kills(state, heroes[0], 4)).toEqual([1, 2, 1, 2]);
    expect(boss.score).toBe(6);
    expect(Number.isInteger(boss.score)).toBe(true);
    expect(boss.bossKills).toBe(4);
  });

  it('5 bohaterów: 1,2 pkt — pięć zabójstw daje 6 pkt; reszta w killAcc jest skończona i < 1', () => {
    const { state, boss, heroes } = bossArena('kolos', far(['H1', 'H2', 'H3', 'H4', 'H5']));
    const pts = kills(state, heroes[0], 4);
    expect(pts).toEqual([1, 1, 1, 1]);
    expect(boss.killAcc).toBe(0.8 * SCORE.killUnits); // 4 × 1,2 pkt = 4 pkt + 0,8 pkt w całkowitych jednostkach
    expect(Number.isInteger(boss.killAcc)).toBe(true);
    expect(kills(state, heroes[1], 1)).toEqual([2]);
    expect(boss.score).toBe(6);
    expect(boss.killAcc).toBe(0);
  });

  it('gracze DNF nie liczą się do liczby bohaterów', () => {
    const { state, boss, heroes } = bossArena('kolos', far(['H1', 'H2', 'H3', 'H4', 'H5']));
    disconnectPlayer(state, 'H4');
    disconnectPlayer(state, 'H5');
    expect(kills(state, heroes[0], 2)).toEqual([2, 2]);
    expect(boss.score).toBe(4);
  });

  it('śmierć bez udziału bossa (teren) ma pts = 0', () => {
    const { state, heroes } = bossArena('kolos', far(['H1', 'H2']));
    heroes[0].hp = 1;
    hurtHero(state, heroes[0], 1, null, heroes[0].x, heroes[0].y);
    expect(state.events.find((e) => e.t === 'heroDie')).toMatchObject({ id: 'H1', by: null, pts: 0 });
  });
});

describe('A4: pokonany boss (dying) nie zarabia', () => {
  it('zabójstwo w trakcie przejścia korony: 0 pkt i brak leczenia Widma', () => {
    const { state, boss, heroes } = bossArena('widmo', far(['H1', 'H2']));
    boss.boss.dying = true;
    boss.boss.hp = 0;
    heroes[0].hp = 1;
    expect(hurtHero(state, heroes[0], 1, 'B', 0, 0)).toBe(true);
    expect(heroes[0].alive).toBe(false);
    expect(boss.score).toBe(0);
    expect(boss.killAcc).toBe(0);
    expect(boss.boss.hp).toBe(0);
    expect(state.events.find((e) => e.t === 'heroDie').pts).toBe(0);
  });
});

describe('A5: równy start', () => {
  const blocked = (m, x, y) => m.obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + HERO.radius);

  it('n graczy co 1/n okręgu, wszyscy tak samo daleko od korony, poza przeszkodami — każda mapa, 2..8 graczy', () => {
    for (const mapId of MAP_IDS) {
      const m = MAPS[mapId];
      const limit = (m.shape === 'rect' ? Math.min(m.hw, m.hh) : m.radius) * MATCH.startRing;
      for (let n = 2; n <= MATCH.maxPlayersLocal; n++) {
        const pts = mapStartPoints(n, mapId);
        expect(pts).toHaveLength(n);
        const d = pts.map(([x, y]) => Math.hypot(x, y));
        const a = pts.map(([x, y]) => Math.atan2(y, x));
        for (let i = 0; i < n; i++) {
          expect(Math.abs(d[i] - d[0])).toBeLessThan(1e-3);
          expect(blocked(m, pts[i][0], pts[i][1])).toBe(false);
          const turn = (((a[(i + 1) % n] - a[i]) / (2 * Math.PI)) % 1 + 1) % 1;
          expect(turn).toBeCloseTo(1 / n, 3);
        }
        expect(d[0]).toBeLessThanOrEqual(limit + 1e-3);
        expect(d[0]).toBeGreaterThan(MATCH.crownPickupRadius + 2);
      }
    }
  });

  it('createMatchState używa układu startowego; punkty odrodzeń zostają bez zmian', () => {
    const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, nick: id, skin: 'mag' }));
    const state = createMatchState({ seed: 1, countdown: 0, players, mapId: 'tundra' });
    expect(state.players.map((p) => [p.x, p.y])).toEqual(mapStartPoints(4, 'tundra'));
    const d = state.players.map((p) => Math.hypot(p.x, p.y));
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(1e-3);
    // odrodzenia: nadal 8 stałych punktów co 1/8 okręgu
    expect(mapSpawnPoint(0, 'arena')).toEqual([11.53, 4.7759]);
    expect(mapSpawnPoint(2, 'arena')).toEqual([-4.7759, 11.53]);
  });

  it('kilku bohaterów przy koronie w tym samym kroku: losuje seeded RNG, nie kolejność w tablicy', () => {
    const takers = {};
    for (let seed = 1; seed <= 120; seed++) {
      const mk = () => {
        const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }], { seed });
        state.players.forEach((p, i) => {
          p.x = Math.cos(i * 2.1);
          p.y = Math.sin(i * 2.1);
        });
        step(state, {});
        return state.transition.newBossId;
      };
      const id = mk();
      expect(mk()).toBe(id); // deterministycznie dla ziarna
      takers[id] = (takers[id] || 0) + 1;
    }
    expect(Object.keys(takers).sort()).toEqual(['A', 'B', 'C']);
    for (const n of Object.values(takers)) expect(n).toBeGreaterThan(20);
  });

  it('jeden kandydat: żadnego dodatkowego losowania (sekwencja RNG jak dotąd)', () => {
    const state = makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }], { seed: 99 });
    state.players[1].x = 0.5;
    state.players[1].y = 0;
    const twin = makeRng({ s: state.rng.s });
    const expected = drawBossType(twin, null);
    step(state, {});
    expect(state.transition.newBossId).toBe('B');
    expect(state.transition.bossType).toBe(expected.type);
    expect(state.transition.strip).toEqual(expected.strip);
    expect(state.rng.s).toBe(twin.next() >= 0 ? state.rng.s : -1); // stan RNG porównany niżej
    const check = makeRng({ s: makeMatch([{ id: 'A' }, { id: 'B' }, { id: 'C' }], { seed: 99 }).rng.s });
    drawBossType(check, null);
    expect(state.transition.offset).toBe(expected.offset);
  });
});

describe('A6: kilku graczy z celem punktowym w tym samym kroku', () => {
  it('wygrywa wyższy wynik, nie pierwszy w tablicy', () => {
    const { state, boss, heroes } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    boss.score = 100;
    heroes[0].score = 109;
    step(state, {});
    expect(state.phase).toBe('ended');
    expect(state.endReason).toBe('score');
    expect(state.winnerId).toBe('H');
  });

  it('remis punktowy: dłuższy czas w koronie', () => {
    const { state, boss, heroes } = bossArena('kolos', [{ id: 'H', x: 0, y: 12 }]);
    boss.score = 104;
    heroes[0].score = 104;
    heroes[0].crownTime = 500;
    step(state, {});
    expect(state.winnerId).toBe('H');
  });
});

describe('B1: overkill nie dolicza się do roszczenia', () => {
  it('cios 30 dmg w bossa z 1 HP daje 1 dmg roszczenia — korona zostaje u tego, kto zadał 55%', () => {
    const { state, boss, heroes } = bossArena('burza', far(['A', 'M']));
    const [a, m] = heroes;
    const max = boss.boss.maxHp;
    withRng(state, () => {
      hurtBoss(state, boss, 0.55 * max, 'A');
      hurtBoss(state, boss, 0.45 * max - 1, 'M');
      expect(boss.boss.hp).toBeCloseTo(1, 6);
      hurtBoss(state, boss, 30, 'M');
    });
    expect(state.transition.newBossId).toBe('A');
    expect(m.dmgToBoss).toBeCloseTo(0.45 * max, 6);
    expect(a.dmgToBoss + m.dmgToBoss).toBeCloseTo(max, 6);
    expect(m.dmgTotal).toBeCloseTo(0.45 * max, 6);
    // zdarzenie nadal pokazuje pełne trafienie
    expect(state.events.filter((e) => e.t === 'bossHit').pop().dmg).toBe(30);
  });
});

describe('B2: tarcza Rycerza a strefa wycelowana prosto w niego', () => {
  const FACINGS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  /** Rycerz w (6,0) z tarczą, boss w (0,0) — kierunek do bossa to −x. */
  function knight(fx, fy) {
    const { state, boss, heroes } = bossArena('kolos', [{ id: 'K', skin: 'rycerz', x: 6, y: 0 }]);
    const k = heroes[0];
    k.fx = fx;
    k.fy = fy;
    k.abilT = SKINS.rycerz.ability.duration;
    return { state, boss, k };
  }

  it('blokuje tylko, gdy tarcza jest zwrócona do bossa, do którego należy strefa (±x, ±y)', () => {
    const result = FACINGS.map(([fx, fy]) => {
      const { state, k } = knight(fx, fy);
      return hurtHero(state, k, 1, 'B', k.x, k.y);
    });
    // trafienie przechodzi: +x tak, −x nie (tarcza do bossa), ±y tak (boss poza łukiem 140°)
    expect(result).toEqual([true, false, true, true]);
  });

  it('bez gracza-źródła (teren, ręce z grobów) atak „spod stóp” nigdy nie jest blokowany', () => {
    for (const [fx, fy] of FACINGS) {
      const { state, k } = knight(fx, fy);
      expect(hurtHero(state, k, 1, null, k.x, k.y)).toBe(true);
      expect(k.hp).toBe(k.maxHp - 1);
    }
  });

  it('prawdziwa strefa (głaz Kolosa) spadająca na Rycerza: wynik zależy od zwrotu do bossa, nie od stron świata', () => {
    const hit = ([fx, fy]) => {
      const { state, k } = knight(fx, fy);
      addZone(state, { kind: 'boulder', shape: 'circle', ownerId: 'B', x: k.x, y: k.y, r: 1.6, warn: 0.1, life: 0.08, dmg: 1 });
      run(state, 12, () => ({ K: inp({ aimX: k.x + fx * 5, aimY: k.y + fy * 5 }) }));
      return k.hp < k.maxHp;
    };
    expect(FACINGS.map(hit)).toEqual([true, false, true, true]);
  });

  it('atak z zewnątrz działa jak dotąd: liczy się kierunek do punktu źródła', () => {
    const { k, boss } = knight(-1, 0);
    expect(shieldBlocks(k, 0, 0, boss)).toBe(true);
    expect(shieldBlocks(k, 12, 0, boss)).toBe(false); // źródło za plecami, choć boss z przodu
    k.abilT = 0;
    expect(shieldBlocks(k, 0, 0, boss)).toBe(false);
  });
});

describe('B3: „ławka” zamiast respawnT = Infinity (Przetrwanie)', () => {
  const allFinite = (v) => (typeof v === 'number' ? Number.isFinite(v) : v && typeof v === 'object' ? Object.values(v).every(allFinite) : true);

  function midWave() {
    const players = [
      { id: 'a', nick: 'a', skin: 'mag' },
      { id: 'b', nick: 'b', skin: 'mag' },
    ];
    const state = createMatchState({ seed: 5, countdown: 0, players, mode: 'survival' });
    run(state, 200);
    expect(state.modeData.stage).toBe('fight');
    const a = state.players[0];
    a.hp = 1;
    a.invulnT = 0;
    withRng(state, () => hurtHero(state, a, 1, null, a.x, a.y));
    return { state, a };
  }

  it('martwy bohater i uśpiony boss AI mają flagę benched, a stan zawiera wyłącznie skończone liczby', () => {
    const { state, a } = midWave();
    expect(a.alive).toBe(false);
    expect(a.benched).toBe(true);
    expect(Number.isFinite(a.respawnT)).toBe(true);
    const ai = state.players.find((p) => p.ai);
    expect([ai.alive, ai.benched, ai.respawnT]).toEqual([false, true, 0]);
    expect(allFinite(state)).toBe(true);
    expect(cloneState(state)).toEqual(state);
  });

  it('po kopii przez JSON w środku fali martwy pozostaje martwy, a obie symulacje biegną identycznie', () => {
    const { state } = midWave();
    const copy = cloneState(state);
    for (let i = 0; i < 180; i++) {
      step(state, {});
      step(copy, {});
      if (state.phase === 'ended') break;
    }
    expect(copy.players[0].alive).toBe(false);
    expect(copy.players.find((p) => p.ai).alive).toBe(false);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(state));
  });

  it('przywrócenie do gry zdejmuje flagę', () => {
    const { state, a } = midWave();
    respawnHero(state, a, makeRng(state.rng), 2);
    expect([a.alive, a.benched]).toEqual([true, false]);
  });
});

describe('B4: Aura Kapłana w Bitwie bossów', () => {
  function teamsMatch() {
    const players = [
      { id: 'b0', nick: 'b0', skin: 'rycerz', team: 0, wantsBoss: true },
      { id: 'k0', nick: 'k0', skin: 'kaplan', team: 0 },
      { id: 'h0', nick: 'h0', skin: 'mag', team: 0 },
      { id: 'b1', nick: 'b1', skin: 'rycerz', team: 1, wantsBoss: true },
      { id: 'h1', nick: 'h1', skin: 'mag', team: 1 },
      { id: 'g1', nick: 'g1', skin: 'mag', team: 1 },
    ];
    const state = createMatchState({ seed: 7, players, countdown: 0, mode: 'teams', mapId: 'arena' });
    state.phase = 'playing';
    const get = (id) => state.players.find((p) => p.id === id);
    for (const p of state.players) if (p.boss) [p.x, p.y] = [p.team === 0 ? -13 : 13, 0];
    return { state, k: get('k0'), ally: get('h0'), foe: get('h1') };
  }

  it('leczy sojusznika i siebie, ale nie bohatera wrogiej drużyny', () => {
    const { state, k, ally, foe } = teamsMatch();
    [k.x, k.y] = [0, 8];
    [ally.x, ally.y] = [1, 8];
    [foe.x, foe.y] = [-1, 8];
    k.hp = ally.hp = foe.hp = 1;
    press(state, 'k0', BTN.ABILITY, { aimX: 0, aimY: 0 });
    expect(k.abilCd).toBeGreaterThan(0);
    expect([k.hp, ally.hp, foe.hp]).toEqual([2, 2, 1]);
  });

  it('w Koronie nadal leczy wszystkich bohaterów w zasięgu, także rywali', () => {
    const { state, heroes } = bossArena('kolos', [
      { id: 'P', skin: 'kaplan', x: 0, y: 10 },
      { id: 'R', x: 1, y: 10 },
    ]);
    heroes[0].hp = heroes[1].hp = 1;
    press(state, 'P', BTN.ABILITY);
    expect([heroes[0].hp, heroes[1].hp]).toEqual([2, 2]);
  });
});

describe('B5: ogłuszenie nie zamraża liczników umiejętności', () => {
  it('Szał Barbarzyńcy upływa także podczas ogłuszenia', () => {
    const { state, heroes } = bossArena('kolos', [{ id: 'H', skin: 'barbarzynca', x: 0, y: 12 }]);
    const h = heroes[0];
    press(state, 'H', BTN.ABILITY);
    expect(h.abilT).toBeCloseTo(SKINS.barbarzynca.ability.duration, 6);
    h.stunT = 1;
    run(state, 60);
    expect(h.abilT).toBeCloseTo(SKINS.barbarzynca.ability.duration - 1, 6);
  });

  it('Łucznik: ładowanie biegnie w ogłuszeniu, ale strzał wychodzi dopiero w pierwszym kroku po nim', () => {
    const { state, heroes } = bossArena('kolos', [{ id: 'H', skin: 'lucznik', x: 0, y: 12 }]);
    const h = heroes[0];
    const aim = { H: inp({ aimX: 0, aimY: 0 }) };
    press(state, 'H', BTN.ABILITY, { aimX: 0, aimY: 0 });
    run(state, 6, () => aim);
    h.stunT = 1; // ogłuszenie w 0,1 s ładowania; ładowanie (0,6 s) kończy się w jego trakcie
    const pierce = () => state.projectiles.filter((p) => p.kind === 'pierce').length;
    let fired = -1;
    for (let i = 1; i <= 120 && fired < 0; i++) {
      step(state, aim);
      if (h.stunT > 0) {
        expect(pierce()).toBe(0);
        expect(h.abilT).toBeGreaterThan(0); // nadal „ładuje/trzyma” — atak podstawowy zablokowany
      } else if (pierce() > 0) fired = i;
    }
    // stary kod: licznik stał w miejscu, więc strzał padał dopiero ~0,5 s po ogłuszeniu (krok ~90)
    expect(fired).toBeGreaterThanOrEqual(60);
    expect(fired).toBeLessThanOrEqual(62);
    expect(h.abilT).toBe(0);
  });

  it('ogłuszony nie atakuje, nie rusza się i nie zaczyna umiejętności', () => {
    const { state, boss, heroes } = bossArena('kolos', [{ id: 'H', skin: 'rycerz', x: -1.7, y: 0 }]);
    const h = heroes[0];
    h.stunT = 0.5;
    const hp = boss.boss.hp;
    const x0 = h.x;
    run(state, 20, () => ({ H: inp({ moveX: -1, aimX: 0, aimY: 0, buttons: BTN.ATTACK | BTN.ABILITY | BTN.DASH }) }));
    expect(boss.boss.hp).toBe(hp);
    expect(h.x).toBeCloseTo(x0, 6);
    expect(h.abilCd).toBe(0);
    expect(h.dashCd).toBe(0);
  });
});

describe('stałe czasu', () => {
  it('DT jest krokiem 60 Hz (testy liczą kroki)', () => {
    expect(DT).toBeCloseTo(1 / 60, 12);
  });
});
